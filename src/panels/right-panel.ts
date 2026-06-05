import { IDS, VERSION, AUTHOR } from '../constants';
import { escapeHtml, setText } from '../utils/dom';
import { getState, saveState } from '../state';
import { findSelected } from './list-panel';
import { renderDetail, renderRightEmpty as renderRightEmptyDetail } from './detail-panel';
import { getCaptureLog } from '../services/note-store';
import { hasAnyNotes, getActiveNotes } from '../services/note-store';

export function renderRightCurrent(): void {
  const state = getState();

  if (state.rightMode === 'console') {
    renderConsole();
    return;
  }
  if (state.rightMode === 'bridge') {
    renderConsole();
    return;
  }

  const item = findSelected();
  if (item) {
    renderDetail({
      title: item.title,
      desc: item.rawText || item.desc,
      author: item.author,
      href: item.href,
      images: item.image ? [item.image] : [],
      comments: [],
      source: 'selected-card',
    });
  } else {
    renderRightEmptyDetail();
  }
}

export function renderConsole(): void {
  setText(IDS.rightTitle, 'NETWORK BRIDGE');
  setActiveTab('console');

  const body = document.getElementById(IDS.rightBody);
  if (!body) return;

  const state = getState();
  const log = getCaptureLog();
  const apiNotes = hasAnyNotes() ? getActiveNotes() : [];

  let logHtml = '';
  if (log.length === 0) {
    logHtml = '<span class="muted">等待原生页面发起 API 请求...</span>\n' +
      '<span class="muted">刷一下原生页面或搜索一个关键词。</span>\n';
  } else {
    logHtml = log.slice(0, 25).map((entry) => {
      const isReq = entry.status === 0 && (entry.method === 'fetch-req' || entry.method === 'xhr-req');
      if (isReq) {
        return '<span class="muted">[→ ' + entry.method.replace('-req', '') + ']</span> ' +
          escapeHtml(entry.url.slice(0, 80));
      }
      return '<span class="green">[' + entry.method + ']</span> ' +
        escapeHtml(entry.url.slice(0, 70)) + ' ' +
        '<span class="yellow">n:' + entry.noteCount + '</span> ' +
        '<span class="blue">c:' + entry.commentCount + '</span>';
    }).join('\n');
  }

  body.innerHTML = [
    '<div class="wb-console">',
      '<span class="green">[V' + VERSION + ']</span> NetworkBridge active\n',
      '<span class="blue">[hook]</span> fetch + XHR in page context\n',
      '<span class="blue">[msgs]</span> received=' + ((window as unknown as Record<string, number>).__xhs_msg_count || 0) + ' | store notes=' + apiNotes.length + ' | log=' + log.length + '\n',
      '<span class="yellow">[route]</span> ' + escapeHtml(location.pathname) + '\n',
      '<span class="yellow">[image]</span> mode = ' + escapeHtml(state.imageMode) + '\n',
      '<span class="yellow">[panel]</span> exp=' + state.explorerWidth + 'px right=' + state.rightWidth + 'px\n',
      '<span class="muted">──────── network capture ────────</span>\n',
      logHtml,
      '\n<span class="muted">[author]</span> ' + AUTHOR,
    '</div>',
  ].join('');
}

export function setActiveTab(mode: string): void {
  const state = getState();
  state.rightMode = mode;
  saveState();

  document.querySelectorAll<HTMLElement>('#' + IDS.app + ' .wb-tab-small').forEach((tab) => {
    tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
  });
}
