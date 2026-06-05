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
const CLICK_WAIT_MS = 3000;
const CLICK_POLL_MS = 250;

export async function loadDetailInHiddenFrame(item: Card): Promise<Detail> {
  const noteId = extractNoteId(item);

  const cached = getCachedRenderedDetail(item);
  if (cached) return cached;

  if (triggerNativeDetail(item)) {
    const polled = await waitForCachedDetail(item);
    if (polled) return polled;
  }

  console.log('[XHS Workbench Shell] showing card data for ' + noteId);
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

/**
 * 用 querySelector 找 Vue hydration 后的真实 DOM 元素，
 * 临时解除 pointer-events:none，派发 click 让 SPA 自己处理。
 * 不调用 .click()（会触发浏览器默认导航），不用数据保存的引用（SSR 时代已失效）。
 */
function triggerNativeDetail(item: Card): boolean {
  const noteId = extractNoteId(item);
  console.log('[XHS Workbench Shell] triggering native click for ' + noteId);

  // 找 .note-item Vue 组件根元素（不是 <a>！点 <a> 会触发浏览器导航）
  const container = findNoteContainer(noteId);
  if (!container) {
    console.warn('[XHS Workbench Shell] no note container found for ' + noteId);
    return false;
  }

  // 临时解除壳层的 pointer-events 阻断
  const r = document.documentElement;
  const prevNative = r.getAttribute('data-xhs-wb4-native-visible');
  r.setAttribute('data-xhs-wb4-native-visible', 'on');

  try {
    container.scrollIntoView({ block: 'center', inline: 'nearest' });

    requestAnimationFrame(() => {
      try {
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        container.dispatchEvent(new MouseEvent('click', {
          bubbles: true, cancelable: true, view: window,
          clientX: cx, clientY: cy, button: 0, buttons: 1,
        }));
        console.log('[XHS Workbench Shell] dispatched click on note container at', cx, cy);
      } finally {
        setTimeout(() => {
          if (prevNative !== null) {
            r.setAttribute('data-xhs-wb4-native-visible', prevNative);
          } else {
            r.removeAttribute('data-xhs-wb4-native-visible');
          }
        }, 500);
      }
    });

    return true;
  } catch (err) {
    r.setAttribute('data-xhs-wb4-native-visible', prevNative || 'off');
    console.warn('[XHS Workbench Shell] native click dispatch failed', err);
    return false;
  }
}

function findNoteContainer(noteId: string): Element | null {
  // 先找 .note-item（Vue 组件根）
  const items = document.querySelectorAll<HTMLElement>('.note-item');
  for (const el of Array.from(items)) {
    if (el.closest('#' + IDS.app)) continue;
    const link = el.querySelector('a[href*="' + noteId + '"]');
    if (link) return el;
  }

  // fallback: 用更宽泛的选择器
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="' + noteId + '"]');
  for (const a of Array.from(links)) {
    if (a.closest('#' + IDS.app)) continue;
    // 返回 link 的父容器，不是 link 本身
    const parent = a.closest('.note-item') || a.closest('[class*="note"]') || a.parentElement;
    if (parent) return parent;
  }

  return null;
}

function waitForCachedDetail(item: Card): Promise<Detail | null> {
  const start = Date.now();

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      const cached = getCachedRenderedDetail(item);
      if (cached) {
        window.clearInterval(timer);
        resolve(cached);
        return;
      }

      if (Date.now() - start >= CLICK_WAIT_MS) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, CLICK_POLL_MS);
  });
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
