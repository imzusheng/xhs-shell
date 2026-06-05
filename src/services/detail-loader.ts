import { IDS } from '../constants';
import { getCleanText, splitLines, safeRect } from '../utils/dom';
import { cacheComments, cacheDetail, getCachedComments, getCachedDetail } from './note-store';
import type { Card } from './card-scanner';
import { parseApiComments, parseApiDetail } from './normalizer';
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

const RESTRICTED_KEYWORDS = ['暂时无法浏览', '请打开小红书App', '扫码查看'];
const COMMENT_SELECTORS = [
  '[class*="comment"]', '[class*="Comment"]',
  '[class*="reply"]', '[class*="Reply"]',
  '[class*="interact"]', '[class*="Interact"]',
];

export async function loadDetailInHiddenFrame(item: Card): Promise<Detail> {
  const noteId = extractNoteId(item);

  const cached = getCachedRenderedDetail(item);
  if (cached) return cached;

  // window.open 真实浏览器窗口 — XHS 相信 isTrusted
  openPopupDetail(item);

  // 等 popup 加载 + bridge 捕获 + postMessage 回来
  await new Promise((r) => setTimeout(r, 5000));

  const after = getCachedRenderedDetail(item);
  if (after) return after;

  console.log('[XHS Workbench Shell] popup timeout for ' + noteId);
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
    images: pickDetailImages(detail, item),
    comments: comments.map((c: NoteComment) => ({ name: c.name, text: c.text })),
    source: detail ? 'api-detail' : 'api-comments',
  };
}

function pickDetailImages(detail: NoteDetail | null, item: Card): string[] {
  if (detail?.images?.length) return detail.images;
  return item.image ? [item.image] : [];
}

function cardOnlyDetail(item: Card): Detail {
  return {
    title: item.title,
    desc: item.rawText || item.desc,
    author: item.author,
    href: item.href,
    images: item.image ? [item.image] : [],
    comments: [],
    source: 'card-only',
  };
}

/**
 * window.open 打开真实浏览器小窗口 — 所有事件 isTrusted:true。
 * 去掉 noopener 让 popup 能 window.opener.postMessage 回传数据。
 */
function openPopupDetail(item: Card): void {
  const href = item.href || '';
  const fullUrl = href.startsWith('http') ? href : location.origin + href;

  let cleanUrl = fullUrl;
  try {
    const u = new URL(fullUrl);
    u.searchParams.delete('xsec_token');
    u.searchParams.delete('xsec_source');
    cleanUrl = u.href;
  } catch { /* ignore */ }

  console.log('[XHS Workbench Shell] opening background window: ' + cleanUrl.slice(0, 80));

  // 最小化窗口，放在左上角，立即藏到主窗口后面
  const popup = window.open(cleanUrl, '_blank', 'width=200,height=200,top=0,left=0');
  if (popup) {
    popup.blur();
    window.focus();
    // 数据回到主窗口后自动关闭（最长 6s）
    setTimeout(() => { try { popup.close(); } catch {} }, 6000);
  }
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
    title: title || noteId,
    desc,
    author,
    href: location.href,
    images,
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
      const name = pickCommentName(node, lines);
      const body = pickCommentBody(text, lines, name);
      out.push({ name: name.slice(0, 32), text: body.slice(0, 420) });
    }
  }
  console.log('[XHS Workbench Shell] extracted ' + out.length + ' comments from DOM');
  return out.slice(0, 30);
}

function isCommentContainerNoise(node: Element, text: string): boolean {
  if (/共\s*\d+\s*条评论|说点什么|发送|取消/.test(text)) return true;
  if ((text.match(/回复/g) || []).length > 4) return true;
  const nested = Array.from(node.querySelectorAll(COMMENT_SELECTORS.join(',')));
  return nested.filter((child) => child !== node && getCleanText(child).length > 6).length > 3;
}

function pickCommentName(node: Element, lines: string[]): string {
  const profile = node.querySelector('a[href*="/user/profile"]');
  const profileName = getCleanText(profile);
  if (profileName.length >= 2 && profileName.length <= 32) return profileName;
  return (lines[0] || '').length <= 30 ? lines[0] : 'comment_user';
}

function pickCommentBody(text: string, lines: string[], name: string): string {
  if (lines.length > 1) return lines.slice(1).join('\n');
  return name && text.startsWith(name) ? text.slice(name.length).trim() : text;
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
