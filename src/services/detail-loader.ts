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
const XHS_API_ORIGIN = 'https://edith.xiaohongshu.com';
const NATIVE_DETAIL_WAIT_MS = 5000;
const NATIVE_DETAIL_POLL_MS = 250;
const COMMENT_SELECTORS = [
  '[class*="comment"]', '[class*="Comment"]',
  '[class*="reply"]', '[class*="Reply"]',
  '[class*="interact"]', '[class*="Interact"]',
];

export async function loadDetailInHiddenFrame(item: Card): Promise<Detail> {
  const noteId = extractNoteId(item);
  const cachedBefore = getCachedRenderedDetail(item);
  if (cachedBefore) return cachedBefore;

  const apiDetail = await loadDetailViaApi(item, noteId);
  if (apiDetail) return apiDetail;

  if (triggerNativeDetail(item, noteId)) {
    const cachedAfter = await waitForCachedDetail(item, noteId);
    if (cachedAfter) return cachedAfter;
  }

  if (isLoginDialogVisible()) {
    console.log('[XHS Workbench Shell] login required before detail API can be captured');
    return {
      title: item.title,
      desc: item.rawText || item.desc,
      author: item.author,
      href: item.href,
      images: item.image ? [item.image] : [],
      comments: [],
      source: 'login-required',
    };
  }

  // fetch/iframe both blocked by XHS. Return card data directly after native trigger timed out.
  console.log('[XHS Workbench Shell] no cached detail, showing card data for ' + noteId);
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

  console.log('[XHS Workbench Shell] using cached native detail for ' + noteId);
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

export function loadCurrentPageDetailFromDom(): Detail | null {
  const noteId = extractNoteIdFromLocation();
  if (!noteId) return null;

  const root = findDetailRoot(document);
  const scanRoot = root || document.body;
  const rawComments = extractCommentsFromDoc(scanRoot);
  const comments = rawComments.map((comment, index) => toNoteComment(noteId, comment, index));
  const cachedComments = getCachedComments(noteId);
  const title = extractCurrentPageTitle(scanRoot);
  const desc = extractDescFromDoc(scanRoot, title) || extractMetaDesc(document);
  const author = extractAuthorFromDoc(scanRoot) || extractMetaAuthor(document);
  const images = extractImagesFromDoc(scanRoot);

  if (!rawComments.length && !title && !desc) return null;

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

function pickDetailImages(detail: NoteDetail | null, item: Card): string[] {
  if (detail?.images?.length) return detail.images;
  return item.image ? [item.image] : [];
}

function extractNoteIdFromLocation(): string {
  const m = location.pathname.match(/\/explore\/([a-zA-Z0-9]{20,})(?:[/?#]|$)/);
  return m?.[1] || '';
}

function extractCurrentPageTitle(root: Element): string {
  const title = extractTitleFromDoc(root, document);
  if (title && !/DETAIL PANEL|XHS Workbench Shell/.test(title)) return title;

  return document.title
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s*-\s*小红书.*$/, '')
    .trim()
    .slice(0, 120);
}

function toNoteDetail(noteId: string, title: string, desc: string, author: string, images: string[]): NoteDetail {
  return {
    noteId,
    title,
    desc,
    author,
    authorId: '',
    images,
    tags: [],
    publishTime: '',
    ipLocation: '',
  };
}

function toNoteComment(noteId: string, comment: Comment, index: number): NoteComment {
  return {
    id: 'dom-' + noteId + '-' + index,
    name: comment.name,
    text: comment.text,
    avatar: '',
    likes: 0,
    time: '',
    subComments: [],
  };
}

async function loadDetailViaApi(item: Card, noteId: string): Promise<Detail | null> {
  const xsecToken = extractXsecToken(item.href);
  if (!noteId) {
    console.log('[XHS Workbench Shell] skip direct API, missing note id');
    return null;
  }

  try {
    const [detailBody, commentBody] = await Promise.all([
      fetchNoteDetailBody(noteId),
      fetchCommentBody(noteId, xsecToken),
    ]);

    const detail = parseApiDetail(detailBody, item.href);
    let comments = parseApiComments(commentBody);
    if (comments.length === 0) {
      comments = extractNativeDomComments(noteId);
    }

    if (detail) cacheDetail(noteId, detail);
    if (comments.length) cacheComments(noteId, comments);

    if (!detail && comments.length === 0) return null;

    return {
      title: detail?.title || item.title,
      desc: detail?.desc || item.rawText || item.desc,
      author: detail?.author || item.author,
      href: item.href,
      images: pickDetailImages(detail, item),
      comments: comments.map((c) => ({ name: c.name, text: c.text })),
      source: comments.length ? 'api-direct-comments' : 'api-direct-detail',
    };
  } catch (err) {
    console.warn('[XHS Workbench Shell] direct API detail failed', err);
    return null;
  }
}

function extractXsecToken(href: string): string {
  try {
    return new URL(href, location.origin).searchParams.get('xsec_token') || '';
  } catch {
    return '';
  }
}

async function fetchNoteDetailBody(noteId: string): Promise<unknown> {
  const resp = await fetch(XHS_API_ORIGIN + '/api/sns/web/v1/feed', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      source_note_id: noteId,
      image_scenes: ['CRD_WM_WEBP'],
    }),
  });

  return resp.json();
}

async function fetchCommentBody(noteId: string, xsecToken: string): Promise<unknown> {
  const url = new URL(XHS_API_ORIGIN + '/api/sns/web/v2/comment/page');
  url.searchParams.set('note_id', noteId);
  url.searchParams.set('cursor', '');
  url.searchParams.set('top_comment_id', '');
  url.searchParams.set('image_scenes', 'CRD_WM_WEBP');
  url.searchParams.set('xsec_token', xsecToken);

  const resp = await fetch(url.href, {
    credentials: 'include',
  });

  return resp.json();
}

function triggerNativeDetail(item: Card, noteId: string): boolean {
  if (!item.link || !document.contains(item.link)) return false;

  console.log('[XHS Workbench Shell] triggering native detail for ' + noteId);

  try {
    item.root.scrollIntoView({ block: 'center', inline: 'nearest' });
    dispatchNativeClickSequence(item.link);
    item.link.click();
    return true;
  } catch (err) {
    console.warn('[XHS Workbench Shell] native detail trigger failed', err);
    return false;
  }
}

function dispatchNativeClickSequence(link: HTMLAnchorElement): void {
  const events: Array<MouseEvent | PointerEvent> = [
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, pointerType: 'mouse' }),
    new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
    new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, pointerType: 'mouse' }),
    new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
    new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
  ];

  events.forEach((event) => {
    link.dispatchEvent(event);
  });
}

function waitForCachedDetail(item: Card, noteId: string): Promise<Detail | null> {
  const start = Date.now();
  let detailOnly: Detail | null = null;

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      const domComments = extractNativeDomComments(noteId);
      if (domComments.length) {
        cacheComments(noteId, domComments);
      }

      const cached = getCachedRenderedDetail(item);
      if (cached?.comments.length) {
        window.clearInterval(timer);
        resolve(cached);
        return;
      }

      if (cached) {
        detailOnly = cached;
      }

      if (Date.now() - start >= NATIVE_DETAIL_WAIT_MS || isLoginDialogVisible()) {
        window.clearInterval(timer);
        resolve(detailOnly);
      }
    }, NATIVE_DETAIL_POLL_MS);
  });
}

function extractNativeDomComments(noteId: string): NoteComment[] {
  if (!isCurrentNotePage(noteId)) return [];

  const comments = extractCommentsFromDoc(document.body);
  return comments.map((comment, index) => toNoteComment(noteId, comment, index));
}

function isCurrentNotePage(noteId: string): boolean {
  if (!noteId) return false;

  try {
    return location.pathname.includes('/explore/' + noteId);
  } catch {
    return false;
  }
}

function isLoginDialogVisible(): boolean {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((node) => {
    const text = getCleanText(node);
    return /登录后推荐|手机号登录|扫码登录|获取验证码/.test(text);
  });

  return candidates.some(isVisibleLoginNode);
}

function isVisibleLoginNode(node: HTMLElement): boolean {
  const rect = safeRect(node);
  if (!rect || rect.width < 20 || rect.height < 10) return false;

  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  if (centerX < 0 || centerY < 0 || centerX > window.innerWidth || centerY > window.innerHeight) return false;

  const topNode = document.elementFromPoint(centerX, centerY);
  if (!topNode) return false;
  if (topNode === node || node.contains(topNode) || topNode.contains(node)) return true;

  const shell = document.getElementById(IDS.app);
  return Boolean(shell && (topNode === shell || shell.contains(topNode)));
}

async function fetchDetailViaFetch(url: string, fallback: Card): Promise<Detail> {
  const resp = await fetch(url, { credentials: 'include' });
  const html = await resp.text();

  if (isRestrictedPage(html)) {
    throw new Error('iframe blocked');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const title = extractMetaTitle(doc) || fallback.title;
  const desc = extractMetaDesc(doc) || fallback.rawText || fallback.desc;
  const author = extractMetaAuthor(doc) || fallback.author;
  const images = extractImagesFromHTML(doc);
  const comments = extractCommentsFromInitialState(html);

  return {
    title,
    desc,
    author,
    href: fallback.href,
    images: images.length ? images : (fallback.image ? [fallback.image] : []),
    comments,
    source: 'fetch-html',
  };
}

function loadDetailViaIframe(item: Card): Promise<Detail> {
  return new Promise((resolve, reject) => {
    const frame = document.getElementById(IDS.frame) as HTMLIFrameElement | null;
    if (!frame) {
      reject(new Error('detail iframe not found'));
      return;
    }

    const url = toAbsoluteUrl(item.href);
    let finished = false;
    const TIMEOUT = 8000;

    function finish(): void {
      if (finished) return;
      finished = true;

      try {
        const doc = frame!.contentDocument || frame!.contentWindow?.document;
        if (!doc?.body) {
          reject(new Error('iframe document not ready'));
          return;
        }

        const text = getCleanText(doc.body);

        if (isRestrictedPage(text)) {
          console.warn('[XHS Workbench Shell] iframe returned restricted page');

          resolve({
            title: item.title,
            desc: item.rawText || item.desc,
            author: item.author,
            href: item.href,
            images: item.image ? [item.image] : [],
            comments: [],
            source: 'iframe-restricted',
          });
          return;
        }

        tryToExpandAndScroll(doc);

        setTimeout(() => {
          try {
            const root = findDetailRoot(doc);
            const images = extractImagesFromDoc(root || doc.body);
            const comments = extractCommentsFromDoc(root || doc.body);

            resolve({
              title: extractTitleFromDoc(root || doc.body, doc) || item.title,
              desc: extractDescFromDoc(root || doc.body, item.title) || item.rawText || item.desc,
              author: extractAuthorFromDoc(root || doc.body) || item.author,
              href: item.href,
              images: images.length ? images : (item.image ? [item.image] : []),
              comments,
              source: 'iframe',
            });
          } catch (err) {
            reject(err);
          }
        }, 2000);
      } catch (err2) {
        reject(err2);
      }
    }

    const timeout = setTimeout(() => {
      console.warn('[XHS Workbench Shell] iframe load timed out');
      resolve({
        title: item.title,
        desc: item.rawText || item.desc,
        author: item.author,
        href: item.href,
        images: item.image ? [item.image] : [],
        comments: [],
        source: 'iframe-timeout',
      });
    }, TIMEOUT);

    frame.onload = () => {
      clearTimeout(timeout);
      setTimeout(() => {
        try {
          const doc = frame!.contentDocument || frame!.contentWindow?.document;
          if (!doc?.body) return;

          const w = frame!.contentWindow;
          if (w) {
            simulateScrollInIframe(doc, w);
          }

          setTimeout(() => simulateScrollInIframe(doc, w!), 600);
          setTimeout(() => simulateScrollInIframe(doc, w!), 1200);
        } catch { /* ignore */ }
        setTimeout(finish, 3000);
      }, 1000);
    };

    try {
      frame.src = url;
    } catch (err3) {
      clearTimeout(timeout);
      reject(err3);
    }
  });
}

function isRestrictedPage(text: string): boolean {
  return RESTRICTED_KEYWORDS.some((kw) => text.includes(kw));
}

function toAbsoluteUrl(href: string): string {
  try {
    return new URL(href, location.origin).href;
  } catch {
    return href;
  }
}

function simulateScrollInIframe(doc: Document, win: Window): void {
  try {
    const h = doc.documentElement.scrollHeight;
    const step = Math.max(200, h / 6);

    for (let y = step; y < h; y += step) {
      doc.documentElement.scrollTo({ top: y, behavior: 'auto' });
    }
    doc.documentElement.scrollTo({ top: h, behavior: 'auto' });

    try {
      const event = new win.MouseEvent('wheel', {
        bubbles: true,
        cancelable: true,
        view: win,
        deltaY: 500,
      });
      doc.body.dispatchEvent(event);
    } catch { /* ignore */ }

    try {
      doc.body.dispatchEvent(new win.Event('scroll', { bubbles: true }));
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

function extractMetaTitle(doc: Document): string {
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) return ogTitle.getAttribute('content') || '';
  const h1 = doc.querySelector('h1');
  if (h1) return getCleanText(h1).slice(0, 120);
  return doc.title.slice(0, 120);
}

function extractMetaDesc(doc: Document): string {
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc) return ogDesc.getAttribute('content') || '';
  const metaDesc = doc.querySelector('meta[name="description"]');
  if (metaDesc) return metaDesc.getAttribute('content') || '';
  return '';
}

function extractMetaAuthor(doc: Document): string {
  const authorMeta = doc.querySelector('meta[name="author"]');
  if (authorMeta) return authorMeta.getAttribute('content') || '';
  return '';
}

function extractImagesFromHTML(doc: Document): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const src = ogImage.getAttribute('content') || '';
    if (src && !isNoiseImage(src)) {
      out.push(src);
      seen.add(src);
    }
  }

  const imgs = doc.querySelectorAll('img');
  for (const img of Array.from(imgs)) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src || seen.has(src) || isNoiseImage(src)) continue;
    seen.add(src);
    out.push(src);
  }

  return out.slice(0, 12);
}

function isNoiseImage(src: string): boolean {
  return /avatar|icon|logo|favicon|emoji|data:|1x1|pixel|beacon|track/i.test(src);
}

function extractCommentsFromInitialState(html: string): Comment[] {
  const out: Comment[] = [];
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});?\s*<\/script>/s);
  if (!match) return out;

  try {
    const data = JSON.parse(match[1].replace(/undefined/g, 'null'));
    const noteData =
      data?.note?.noteDetailMap ||
      data?.note?.noteList?.[0] ||
      data?.note ||
      {};

    const commentList =
      noteData?.comments ||
      noteData?.commentList ||
      noteData?.comment_info?.comment_list ||
      [];

    for (const c of Array.isArray(commentList) ? commentList : []) {
      const name = c?.user_info?.nickname || c?.nickname || c?.user?.nickname || '';
      const text = c?.content || c?.text || c?.comment || '';
      if (text && text.length > 2) {
        out.push({ name: name.slice(0, 32), text: text.slice(0, 420) });
      }
    }
  } catch { /* ignore */ }

  console.log('[XHS Workbench Shell] extracted ' + out.length + ' comments from __INITIAL_STATE__');
  return out.slice(0, 30);
}

function findDetailRoot(doc: Document): Element | null {
  const selectors = [
    '[role="dialog"]', '[class*="note-detail"]', '[class*="NoteDetail"]',
    '[class*="detail"]', '[class*="Detail"]', '[class*="modal"]',
    '[class*="drawer"]', 'main', 'article',
  ];

  let best: Element | null = null;
  let bestScore = 0;

  for (const sel of selectors) {
    const nodes = doc.querySelectorAll(sel);
    for (const node of Array.from(nodes)) {
      const shell = doc.getElementById?.(IDS.app);
      if (shell?.contains(node)) continue;

      const text = getCleanText(node);
      const imgCount = node.querySelectorAll('img').length;
      const score = text.length + imgCount * 180;
      if (score > bestScore && text.length > 40) {
        best = node;
        bestScore = score;
      }
    }
  }

  return best;
}

function tryToExpandAndScroll(doc: Document): void {
  try {
    doc.documentElement.scrollTop = doc.documentElement.scrollHeight;
  } catch { /* ignore */ }

  const nodes = doc.querySelectorAll('button,span,div');
  let count = 0;

  for (const node of Array.from(nodes)) {
    if (count > 15) break;
    const text = getCleanText(node);
    if (/展开|更多|查看全部|加载更多|more/i.test(text) && text.length <= 16) {
      try {
        (node as HTMLElement).click();
        count++;
      } catch { /* ignore */ }
    }
  }
}

function extractImagesFromDoc(root: Element): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const imgs = root.querySelectorAll('img');

  for (const img of Array.from(imgs)) {
    const shell = document.getElementById(IDS.app);
    if (shell?.contains(img)) continue;

    const src = (img as HTMLImageElement).currentSrc ||
      (img as HTMLImageElement).src ||
      img.getAttribute('src') || '';
    if (!src || src.startsWith('data:') || seen.has(src)) continue;
    if (/avatar|icon|logo|favicon|emoji/i.test(src)) continue;
    seen.add(src);
    out.push(src);
  }

  return out.slice(0, 12);
}

function extractCommentsFromDoc(root: Element): Comment[] {
  const out: Comment[] = [];
  const seen = new Set<string>();

  for (const sel of COMMENT_SELECTORS) {
    const nodes = root.querySelectorAll(sel);
    for (const node of Array.from(nodes)) {
      const shell = document.getElementById(IDS.app);
      if (shell?.contains(node)) continue;

      const text = getCleanText(node);
      if (isCommentContainerNoise(node, text)) continue;
      if (!text || text.length < 6 || text.length > 600) continue;
      if (seen.has(text)) continue;
      if (/评论数据未加载|DETAIL PANEL|source:|Open in XHS/.test(text)) continue;
      if (/^(评论|回复|展开|加载更多|查看更多)/.test(text) && text.length < 14) continue;
      seen.add(text);

      const lines = splitLines(text);
      const name = pickCommentName(node, lines);
      const body = pickCommentBody(text, lines, name);

      out.push({ name: name.slice(0, 32), text: body.slice(0, 420) });
    }
  }

  console.log('[XHS Workbench Shell] extracted ' + out.length + ' comments from iframe DOM');
  return out.slice(0, 30);
}

function isCommentContainerNoise(node: Element, text: string): boolean {
  if (/共\s*\d+\s*条评论|说点什么|发送|取消|可以添加到收藏夹/.test(text)) return true;
  if ((text.match(/回复/g) || []).length > 4) return true;

  const nested = Array.from(node.querySelectorAll(COMMENT_SELECTORS.join(',')));
  return nested.filter((child) => child !== node && getCleanText(child).length > 6).length > 3;
}

function pickCommentName(node: Element, lines: string[]): string {
  const profile = node.querySelector('a[href*="/user/profile"]');
  const profileName = getCleanText(profile);
  if (profileName.length >= 2 && profileName.length <= 32) return profileName;

  const firstLine = lines[0] || '';
  return firstLine.length <= 30 ? firstLine : 'comment_user';
}

function pickCommentBody(text: string, lines: string[], name: string): string {
  if (lines.length > 1) return lines.slice(1).join('\n');
  if (name && text.startsWith(name)) return text.slice(name.length).trim();
  return text;
}

function extractTitleFromDoc(root: Element, doc: Document): string {
  const nodes = root.querySelectorAll('[class*="title"],[class*="Title"],h1,h2');
  for (const node of Array.from(nodes)) {
    const text = getCleanText(node);
    if (text && text.length >= 2 && text.length <= 120) return text;
  }
  return doc.title.slice(0, 120);
}

function extractDescFromDoc(root: Element, title: string): string {
  const nodes = root.querySelectorAll('[class*="desc"],[class*="Desc"],[class*="content"],[class*="Content"]');
  for (const node of Array.from(nodes)) {
    const text = getCleanText(node);
    if (text && text !== title && text.length >= 8 && text.length <= 2000) return text;
  }
  return '';
}

function extractAuthorFromDoc(root: Element): string {
  const nodes = root.querySelectorAll('[class*="author"],[class*="user"],[class*="nickname"],[class*="name"]');
  for (const node of Array.from(nodes)) {
    const text = getCleanText(node);
    if (text && text.length >= 2 && text.length <= 32) return text;
  }
  return '';
}
