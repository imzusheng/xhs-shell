import { IDS, VERSION, AUTHOR, INIT_SCAN_DELAY_MS } from './constants';
import { loadState, setRootState, applyAppState, applyPanelSize, getState } from './state';
import { byId } from './utils/dom';
import { addStyle, createApp } from './app';
import { bindAppEvents, bindGlobalEvents } from './events';
import { observeNativePage } from './observer';
import { registerMenu } from './gm-menu';
import { scanNativeCards } from './services/card-scanner';
import { doSearch as doSearchService } from './services/search';
import { renderList, bumpDetailLoadToken, setSelectedId, findSelected } from './panels/list-panel';
import { renderDetail, renderDetailLoading, renderRightEmpty } from './panels/detail-panel';
import { loadDetailInHiddenFrame, getCachedRenderedDetail, loadCurrentPageDetailFromDom } from './services/detail-loader';
import { getPageHookCode } from './inject/page-hook';
import { initNetworkBridge, parseInitialState } from './services/network-bridge';
import { setOnUpdated, cacheComments, cacheDetail } from './services/note-store';
import type { Card } from './services/card-scanner';
import type { Detail } from './services/detail-loader';

(function () {
  'use strict';

  if (window.top !== window.self) return;

  function onTagClick(tag: string): void {
    doSearchService(tag);
  }

  function openShellDetail(item: Card): void {
    setSelectedId(item.id);
    renderList(openShellDetail, onTagClick);
    renderDetailLoading(item);

    const currentToken = bumpDetailLoadToken();

    loadDetailInHiddenFrame(item).then((detail: Detail) => {
      if (currentToken !== 0) renderDetail(detail);
    }).catch((err: Error) => {
      console.warn('[XHS Workbench Shell] detail fallback', err);
      renderDetail({
        title: item.title,
        desc: item.rawText || item.desc,
        author: item.author,
        href: item.href,
        images: item.image ? [item.image] : [],
        comments: [],
        source: 'fallback-card',
      });
    });
  }

  // ─── Listen for popup relayed data ───
  function listenPopupRelay(): void {
    window.addEventListener('message', (e) => {
      if (!e.data?.__xhs_wb5_popup) return;
      const { noteId, data } = e.data as { noteId: string; data: Record<string, unknown> };
      if (!noteId) return;

      if (data.detail) cacheDetail(noteId, data.detail as import('./services/normalizer').NoteDetail);
      if (data.comments) cacheComments(noteId, data.comments as import('./services/normalizer').NoteComment[]);

      console.log('[XHS Workbench Shell] received popup data for ' + noteId);

      // trigger re-render
      renderList(openShellDetail, onTagClick);
      const sel = findSelected();
      if (sel && getState().rightMode === 'detail') {
        const cached = getCachedRenderedDetail(sel);
        if (cached) renderDetail(cached);
      }
    });
  }

  function bootEarly(): void {
    initNetworkBridge();
    injectPageHook();
    listenPopupRelay();

    setOnUpdated(() => {
      renderList(openShellDetail, onTagClick);
      const sel = findSelected();
      if (sel && getState().rightMode === 'detail') {
        const cached = getCachedRenderedDetail(sel);
        if (cached) renderDetail(cached);
      }
    });

    console.log('[XHS Workbench Shell V' + VERSION + '] booted');
  }

  function injectPageHook(): void {
    const script = document.createElement('script');
    script.textContent = getPageHookCode();
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function renderCurrentPageDetail(): boolean {
    const detail = loadCurrentPageDetailFromDom();
    if (!detail) return false;
    renderDetail(detail);
    return true;
  }

  function initUI(): void {
    loadState();
    setRootState();
    addStyle();
    createApp();
    bindGlobalEvents();
    bindAppEvents();
    registerMenu(openShellDetail, onTagClick);
    applyPanelSize();

    const input = byId(IDS.searchInput) as HTMLInputElement | null;
    if (input) input.value = getState().query || '';

    parseInitialState();

    setTimeout(() => {
      scanNativeCards(false);
      renderList(openShellDetail, onTagClick);
      renderRightEmpty();
      renderCurrentPageDetail();
    }, INIT_SCAN_DELAY_MS);

    observeNativePage(openShellDetail, onTagClick);
    applyAppState();

    console.log('[XHS Workbench Shell V' + VERSION + '] UI ready', getState());
  }

  bootEarly();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI, false);
  } else {
    initUI();
  }
})();

declare global {
  interface Window {
    __xhs_cards_len?: number;
    __INITIAL_STATE__?: unknown;
  }
}
