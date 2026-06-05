import { IDS, NOISE_PATTERNS } from '../constants';
import { getCleanText, splitLines, safeRect } from '../utils/dom';
import { simpleHash, canonicalNoteKey } from '../utils/hash';

export interface Card {
  id: string;
  noteKey: string;
  href: string;
  root: Element;
  link: HTMLAnchorElement;
  title: string;
  desc: string;
  author: string;
  image: string;
  rawText: string;
  status: string;
}

let cards: Card[] = [];

export function getCards(): Card[] {
  return cards;
}

export function setCards(next: Card[]): void {
  cards = next;
}

export function scanNativeCards(allowEmpty: boolean): number {
  const next: Card[] = [];
  const seenKey: Record<string, boolean> = {};
  const seenRoot: WeakSet<object> | null = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  const links = document.querySelectorAll('a[href]');

  links.forEach((a) => {
    if (isInShell(a)) return;

    const href = a.getAttribute('href') || '';
    if (!isUsefulNoteHref(href)) return;

    const root = findCardRoot(a);
    if (!root || isInShell(root)) return;
    if (seenRoot?.has(root)) return;

    const item = extractCard(root, a as HTMLAnchorElement, normalizeHref(href));
    if (!item?.title) return;

    const key = item.noteKey || canonicalNoteKey(item.href);
    if (seenKey[key]) return;

    seenKey[key] = true;
    seenRoot?.add(root);
    next.push(item);
  });

  if (next.length || allowEmpty) {
    cards = next.slice(0, 200);
  }

  return cards.length;
}

function isInShell(node: Element): boolean {
  return !!(node?.closest?.('#' + IDS.app));
}

function isUsefulNoteHref(href: string): boolean {
  if (!href) return false;
  if (href.includes('/user/profile/')) return false;
  return href.includes('/explore/') ||
    href.includes('/search_result/') ||
    href.includes('/discovery/item/');
}

function normalizeHref(href: string): string {
  let clean = href.split('#')[0];
  clean = clean.replace(/^https?:\/\/[^/]+/, '');

  try {
    const url = new URL(clean, location.origin);
    const path = url.pathname;
    const xsecToken = url.searchParams.get('xsec_token');
    if (xsecToken) return path + '?xsec_token=' + encodeURIComponent(xsecToken);
    return path;
  } catch {
    return clean || href;
  }
}

function findCardRoot(anchor: HTMLAnchorElement): Element | null {
  let node: Element | null = anchor;
  let best: Element | null = null;
  let depth = 0;

  while (node && node !== document.body && depth < 9) {
    const rect = safeRect(node);
    const text = getCleanText(node);
    const mediaCount = node.querySelectorAll ? node.querySelectorAll('img,video,canvas').length : 0;

    if (
      rect &&
      rect.width >= 120 && rect.height >= 50 &&
      rect.width <= 1100 && rect.height <= 1000 &&
      (mediaCount > 0 || text.length > 16)
    ) {
      best = node;
    }
    node = node.parentElement;
    depth++;
  }

  return best || anchor;
}

function extractCard(root: Element, link: HTMLAnchorElement, href: string): Card {
  const text = getCleanText(root);
  const lines = splitLines(text);
  const title = pickTitle(lines, href);
  const author = pickAuthor(lines);
  const img = pickImage(root);
  const noteKey = canonicalNoteKey(href);
  const id = simpleHash(noteKey + '|' + title);

  return {
    id,
    noteKey,
    href,
    root,
    link,
    title,
    desc: pickDesc(lines, title),
    author,
    image: img,
    rawText: text,
    status: '200 OK',
  };
}

function pickTitle(lines: string[], href: string): string {
  for (let i = 0; i < lines.length; i++) {
    if (!isNoiseLine(lines[i])) {
      return lines[i].slice(0, 80);
    }
  }
  return href.replace(/^\/+/, '').slice(0, 80) || 'untitled note';
}

function pickDesc(lines: string[], title: string): string {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== title && !isNoiseLine(lines[i])) {
      return lines[i].slice(0, 120);
    }
  }
  return 'await fetchNoteDetail();';
}

function pickAuthor(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (
      lines[i].length >= 2 &&
      lines[i].length <= 24 &&
      !/[0-9.万kK]+/.test(lines[i])
    ) {
      return lines[i];
    }
  }
  return 'xhs_user';
}

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line)) || line.length <= 1;
}

function pickImage(root: Element): string {
  const imgs = root.querySelectorAll ? root.querySelectorAll('img') : new NodeList() as unknown as NodeListOf<HTMLImageElement>;
  let best = '';

  imgs.forEach((img) => {
    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    const rect = safeRect(img);
    if (!src || src.startsWith('data:')) return;
    if (isAvatarOrIcon(src)) return;
    if (!best) best = src;
    if (rect && rect.width >= 50 && rect.height >= 50) best = src;
  });

  return best;
}

function isAvatarOrIcon(src: string): boolean {
  return /avatar|icon|logo|favicon|emoji/i.test(String(src ?? ''));
}

declare global {
  interface Window {
    __xhs_cards_len?: number;
  }
}
