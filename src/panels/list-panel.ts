import { IDS } from '../constants';
import { escapeHtml, escapeAttr, pad } from '../utils/dom';
import { getCards, type Card } from '../services/card-scanner';
import { getIsListLoading } from '../services/search';
import { getActiveNotes, hasAnyNotes } from '../services/note-store';
import type { NormalizedNote } from '../services/normalizer';

let selectedId = '';
let detailLoadToken = 0;

export function getSelectedId(): string {
  return selectedId;
}

export function setSelectedId(id: string): void {
  selectedId = id;
}

export function getDetailLoadToken(): number {
  return detailLoadToken;
}

export function bumpDetailLoadToken(): number {
  return ++detailLoadToken;
}

export function findCard(id: string): Card | null {
  const cards = getCards();
  for (const item of cards) {
    if (item.id === id) return item;
  }
  return null;
}

export function findSelected(): Card | null {
  if (!selectedId) return null;
  return findCard(selectedId);
}

export function renderList(openDetailCb: (item: Card) => void, onTagClick: (tag: string) => void): void {
  const list = document.getElementById(IDS.list);
  if (!list) return;

  if (getIsListLoading()) {
    renderListLoading();
    renderTags(onTagClick);
    return;
  }

  const apiNotes = hasAnyNotes() ? getActiveNotes() : null;

  if (apiNotes && apiNotes.length > 0) {
    renderApiList(list, apiNotes, openDetailCb);
    renderTags(onTagClick);
    return;
  }

  const cards = getCards();
  const shown = dedupeShownCards(cards);

  if (!shown.length) {
    list.innerHTML = '<div class="wb-empty">No native cards found yet.<br/>等待小红书原生页面加载完成，或搜索一个关键词。</div>';
    renderTags(onTagClick);
    return;
  }

  list.innerHTML = shown.map((item, index) => {
    const selected = item.id === selectedId ? ' selected' : '';
    const img = item.image ? '<img src="' + escapeAttr(item.image) + '" />' : 'IMG';

    return [
      '<div class="wb-card' + selected + '" data-id="' + escapeAttr(item.id) + '">',
        '<div class="wb-thumb">' + img + '</div>',
        '<div>',
          '<div class="wb-card-code">' + pad(index + 1, 4) + ' const note = await open("' + escapeHtml(shortHref(item.href)) + '");</div>',
          '<div class="wb-card-title">' + escapeHtml(item.title) + '</div>',
          '<div class="wb-card-desc">' + escapeHtml(item.desc) + '</div>',
        '</div>',
        '<div class="wb-card-author">' + escapeHtml(item.author) + '</div>',
        '<div class="wb-card-action">',
          '<div class="wb-card-status">' + escapeHtml(item.status) + '</div>',
          '<div>inspect →</div>',
        '</div>',
      '</div>',
    ].join('');
  }).join('');

  list.querySelectorAll<HTMLElement>('.wb-card').forEach((node) => {
    node.addEventListener('click', () => {
      const id = node.getAttribute('data-id');
      const item = findCard(id!);
      if (item) openDetailCb(item);
    });
  });

  renderTags(onTagClick);
}

function renderApiList(list: HTMLElement, notes: NormalizedNote[], openDetailCb: (item: Card) => void): void {
  list.innerHTML = notes.map((note, index) => {
    const img = note.cover ? '<img src="' + escapeAttr(note.cover) + '" />' : 'IMG';

    return [
      '<div class="wb-card" data-noteid="' + escapeAttr(note.noteId) + '">',
        '<div class="wb-thumb">' + img + '</div>',
        '<div>',
          '<div class="wb-card-code">' + pad(index + 1, 4) + ' [API] note.open("' + escapeHtml(note.noteId.slice(0, 12)) + '")</div>',
          '<div class="wb-card-title">' + escapeHtml(note.title) + '</div>',
          '<div class="wb-card-desc">' + escapeHtml((note.desc || note.author).slice(0, 80)) + '</div>',
        '</div>',
        '<div class="wb-card-author">' + escapeHtml(note.author) + '</div>',
        '<div class="wb-card-action">',
          '<div class="wb-card-status green">API</div>',
          '<div>inspect →</div>',
        '</div>',
      '</div>',
    ].join('');
  }).join('');

  list.querySelectorAll<HTMLElement>('.wb-card').forEach((node) => {
    node.addEventListener('click', () => {
      const noteId = node.getAttribute('data-noteid') || '';
      const note = notes.find((n) => n.noteId === noteId);
      if (note) {
        const card: Card = {
          id: 'api_' + note.noteId,
          noteKey: 'api:' + note.noteId,
          href: note.href,
          root: node,
          link: document.createElement('a'),
          title: note.title,
          desc: note.desc || note.author,
          author: note.author,
          image: note.cover,
          rawText: note.desc || note.title,
          status: 'API OK',
        };
        openDetailCb(card);
      }
    });
  });
}

function renderListLoading(): void {
  const list = document.getElementById(IDS.list);
  if (!list) return;

  const q = (document.getElementById(IDS.searchInput) as HTMLInputElement | null)?.value || '';

  list.innerHTML = [
    '<div class="wb-empty">',
      '<div class="wb-loading" style="max-width:560px;margin:36px auto;text-align:left;">',
        '<div class="wb-spinner"></div>',
        '<div style="flex:1;min-width:0;">',
          '<div class="blue">await searchNative("' + escapeHtml(q) + '")</div>',
          '<div class="muted">正在等待原生搜索页加载结果，不需要手动点击 Refresh。</div>',
          '<div class="wb-skeleton" style="width:92%;"></div>',
          '<div class="wb-skeleton" style="width:74%;"></div>',
          '<div class="wb-skeleton" style="width:58%;"></div>',
        '</div>',
      '</div>',
    '</div>',
  ].join('');
}

function dedupeShownCards(list: Card[]): Card[] {
  const seen: Record<string, boolean> = {};
  const out: Card[] = [];

  for (const item of list) {
    const key = item.noteKey;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(item);
  }

  return out;
}

function renderTags(onTagClick: (tag: string) => void): void {
  const node = document.getElementById(IDS.tags);
  if (!node) return;

  const tags = ['推荐', '穿搭', '美食', '彩妆', '影视', '职场', '情感', '家居', '游戏', '旅行', '健身', '视频'];

  node.innerHTML = tags.map((tag) =>
    '<span class="wb-tag" data-tag="' + escapeAttr(tag) + '">' + escapeHtml(tag) + '</span>'
  ).join('');

  node.querySelectorAll<HTMLElement>('.wb-tag').forEach((tagNode) => {
    tagNode.addEventListener('click', () => {
      const tag = tagNode.getAttribute('data-tag') || '';
      const input = document.getElementById(IDS.searchInput) as HTMLInputElement | null;
      if (input) input.value = tag;
      onTagClick(tag);
    });
  });
}

export function shortHref(href: string): string {
  const v = String(href || '').split('?')[0];
  return v.length > 38 ? v.slice(0, 35) + '...' : v;
}
