import { IDS } from '../constants';
import { getCleanText, splitLines } from '../utils/dom';
import { cacheComments, cacheDetail, getCachedComments, getCachedDetail } from './note-store';
import type { Card } from './card-scanner';
import type { NoteComment, NoteDetail } from './normalizer';

export interface Comment {
  name: string;
  text: string;
}

export interface Detail {
  title: string;
  desc: string;
  author: string;
  href: string;
  images: string[];
  comments: Comment[];
  source: string;
}

const COMMENT_SELECTORS = [
  '[class*="comment"]', '[class*="Comment"]',
  '[class*="reply"]', '[class*="Reply"]',
  '[class*="interact"]', '[class*="Interact"]',
];

/**
 * 加载详情数据。
 * 壳层不主动触发任何程序化操作（点击/跳转/弹窗），只消费已捕获的数据。
 * - 缓存命中 → 直接返回
 * - 无缓存 → 返回卡片现有数据（bridge 稍后捕获到数据会自动触发重渲染）
 */
export async function loadDetailInHiddenFrame(item: Card): Promise<Detail> {
  const cached = getCachedRenderedDetail(item);
  if (cached) return cached;

  const noteId = extractNoteId(item);
  console.log('[XHS Workbench Shell] no cached detail for ' + noteId);
  return cardOnlyDetail(item);
}

function extractNoteId(item: Card): string {
  const href = item.href || '';
  const m = href.match(/\/([a-zA-Z0-9]{20,})(?:[/?#]|$)/);
  return m?.[1] || item.noteKey.replace(/^(note:|api:)/, '');
}

export function getCachedRenderedDetail(item: Card): Detail | null {
  const noteId = extractNoteId(item);
  const detail = getCachedDetail(noteId);
  const comments = getCachedComments(noteId);

  if (!detail && comments.length === 0) return null;

  console.log('[XHS Workbench Shell] using cached detail for ' + noteId);
  return {
    title: detail?.title || item.title,
    desc: detail?.desc || item.rawText || item.desc,
    author: detail?.author || item.author,
    href: item.href,
    images: detail?.images?.length ? detail.images : (item.image ? [item.image] : []),
    comments: comments.map((c: NoteComment) => ({ name: c.name, text: c.text })),
    source: detail ? 'api-detail' : 'api-comments',
  };
}

function cardOnlyDetail(item: Card): Detail {
  return {
    title: item.title, desc: item.rawText || item.desc, author: item.author,
    href: item.href, images: item.image ? [item.image] : [], comments: [],
    source: 'card-only',
  };
}

export function loadCurrentPageDetailFromDom(): Detail | null {
  const noteId = extractNoteIdFromLocation();
  if (!noteId) return null;

  const root = findDetailRoot(document);
  const scanRoot = root || document.body;
  const rawComments = extractCommentsFromDoc(scanRoot);
  const cachedComments = getCachedComments(noteId);
  const title = extractCurrentPageTitle(scanRoot);
  const desc = extractDescFromDoc(scanRoot, title);
  const author = extractAuthorFromDoc(scanRoot);
  const images = extractImagesFromDoc(scanRoot);

  if (!rawComments.length && !title) return null;

  const comments = rawComments.map((comment, index) => toNoteComment(noteId, comment, index));

  if (!getCachedDetail(noteId)) {
    cacheDetail(noteId, toNoteDetail(noteId, title, desc, author, images));
  }
  if (comments.length && cachedComments.length < comments.length) {
    cacheComments(noteId, comments);
  }

  return {
    title: title || noteId, desc, author, href: location.href, images,
    comments: rawComments,
    source: rawComments.length ? 'native-dom-comments' : 'native-dom-detail',
  };
}

function extractNoteIdFromLocation(): string {
  const m = location.pathname.match(/\/explore\/([a-zA-Z0-9]{20,})(?:[/?#]|$)/);
  return m?.[1] || '';
}

function extractCurrentPageTitle(root: Element): string {
  const title = extractTitleFromDoc(root, document);
  if (title && !/DETAIL PANEL|XHS Workbench Shell/.test(title)) return title;
  return document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*小红书.*$/, '').trim().slice(0, 120);
}

function toNoteDetail(noteId: string, title: string, desc: string, author: string, images: string[]): NoteDetail {
  return { noteId, title, desc, author, authorId: '', images, tags: [], publishTime: '', ipLocation: '' };
}

function toNoteComment(noteId: string, comment: Comment, index: number): NoteComment {
  return { id: 'dom-' + noteId + '-' + index, name: comment.name, text: comment.text, avatar: '', likes: 0, time: '', subComments: [] };
}

function findDetailRoot(doc: Document): Element | null {
  const selectors = ['[role="dialog"]', '[class*="note-detail"]', '[class*="NoteDetail"]', '[class*="detail"]', '[class*="modal"]', 'main', 'article'];
  let best: Element | null = null;
  let bestScore = 0;
  for (const sel of selectors) {
    for (const node of Array.from(doc.querySelectorAll(sel))) {
      const shell = doc.getElementById?.(IDS.app);
      if (shell?.contains(node)) continue;
      const text = getCleanText(node);
      const score = text.length + node.querySelectorAll('img').length * 180;
      if (score > bestScore && text.length > 40) { best = node; bestScore = score; }
    }
  }
  return best;
}

function extractCommentsFromDoc(root: Element): Comment[] {
  const out: Comment[] = [];
  const seen = new Set<string>();
  for (const sel of COMMENT_SELECTORS) {
    for (const node of Array.from(root.querySelectorAll(sel))) {
      const shell = document.getElementById(IDS.app);
      if (shell?.contains(node)) continue;
      const text = getCleanText(node);
      if (isCommentContainerNoise(node, text)) continue;
      if (!text || text.length < 6 || text.length > 600) continue;
      if (seen.has(text)) continue;
      if (/评论数据未加载|DETAIL PANEL|source:|Open in XHS/.test(text)) continue;
      if (/^(评论|回复|展开|加载更多)/.test(text) && text.length < 14) continue;
      seen.add(text);
      const lines = splitLines(text);
      const name = lines[0]?.length <= 30 ? lines[0] : 'comment_user';
      const body = lines.length > 1 ? lines.slice(1).join('\n') : text;
      out.push({ name: name.slice(0, 32), text: body.slice(0, 420) });
    }
  }
  return out.slice(0, 30);
}

function isCommentContainerNoise(node: Element, text: string): boolean {
  if (/共\s*\d+\s*条评论|说点什么|发送|取消/.test(text)) return true;
  if ((text.match(/回复/g) || []).length > 4) return true;
  return Array.from(node.querySelectorAll(COMMENT_SELECTORS.join(',')))
    .filter((child) => child !== node && getCleanText(child).length > 6).length > 3;
}

function extractImagesFromDoc(root: Element): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const shell = document.getElementById(IDS.app);
    if (shell?.contains(img)) continue;
    const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || img.getAttribute('src') || '';
    if (!src || src.startsWith('data:') || seen.has(src)) continue;
    if (/avatar|icon|logo|favicon|emoji/i.test(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out.slice(0, 12);
}

function extractTitleFromDoc(root: Element, doc: Document): string {
  for (const node of Array.from(root.querySelectorAll('[class*="title"],[class*="Title"],h1,h2'))) {
    const text = getCleanText(node);
    if (text && text.length >= 2 && text.length <= 120) return text;
  }
  return doc.title.slice(0, 120);
}

function extractDescFromDoc(root: Element, title: string): string {
  for (const node of Array.from(root.querySelectorAll('[class*="desc"],[class*="content"]'))) {
    const text = getCleanText(node);
    if (text && text !== title && text.length >= 8 && text.length <= 2000) return text;
  }
  return '';
}

function extractAuthorFromDoc(root: Element): string {
  for (const node of Array.from(root.querySelectorAll('[class*="author"],[class*="user"],[class*="nickname"],a[href*="/user/profile"]'))) {
    const text = getCleanText(node);
    if (text && text.length >= 2 && text.length <= 32) return text;
  }
  return '';
}
