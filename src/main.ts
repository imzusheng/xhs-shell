import { IDS, VERSION, AUTHOR, INIT_SCAN_DELAY_MS } from './constants';
import { loadState, setRootState, applyAppState, applyPanelSize, getState } from './state';
import { byId } from './utils/dom';
import { addStyle, createApp } from './app';
import { bindAppEvents } from './events';
import { bindGlobalEvents } from './events';
import { observeNativePage } from './observer';
import { registerMenu } from './gm-menu';
import { scanNativeCards } from './services/card-scanner';
import { doSearch as doSearchService } from './services/search';
import { renderList, bumpDetailLoadToken, setSelectedId, findSelected } from './panels/list-panel';
import { renderDetail, renderDetailLoading, renderRightEmpty } from './panels/detail-panel';
import { loadDetailInHiddenFrame, getCachedRenderedDetail, loadCurrentPageDetailFromDom } from './services/detail-loader';
import { getPageHookCode } from './inject/page-hook';
import { initNetworkBridge, parseInitialState } from './services/network-bridge';
import { setOnUpdated } from './services/note-store';
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
      if (currentToken !== 0) {
        renderDetail(detail);
      }
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

  // ─── Phase A: document-start ───
  // 必须最先执行：先装 hook 和 bridge，再让 XHS 自己的脚本跑，
  // 否则首屏 homefeed 接口请求会漏掉。
  function injectPageHookEarly(): void {
    const script = document.createElement('script');
    script.textContent = getPageHookCode();
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function bootEarly(): void {
    initNetworkBridge();
    injectPageHookEarly();
    setOnUpdated(() => {
      renderList(openShellDetail, onTagClick);
      const selected = findSelected();
      if (selected && getState().rightMode === 'detail') {
        const cached = getCachedRenderedDetail(selected);
        if (cached) renderDetail(cached);
      } else if (getState().rightMode === 'detail') {
        renderCurrentPageDetail();
      }
    });
    console.log('[XHS Workbench Shell V' + VERSION + '] early boot: hook + bridge installed');
  }

  function renderCurrentPageDetail(): boolean {
    const detail = loadCurrentPageDetailFromDom();
    if (!detail) return false;

    renderDetail(detail);
    return true;
  }

  // ─── Phase B: DOM ready ───
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
    if (input) {
      input.value = getState().query || '';
    }

    // 解析 SSR 注入的首屏笔记
    parseInitialState();

    setTimeout(() => {
      scanNativeCards(false);
      renderList(openShellDetail, onTagClick);
      renderRightEmpty();
      renderCurrentPageDetail();
    }, INIT_SCAN_DELAY_MS);

    observeNativePage(openShellDetail, onTagClick);
    applyAppState();

    console.log('[XHS Workbench Shell V' + VERSION + '] UI ready | by ' + AUTHOR, getState());
  }

  // hook 越早越好，立即执行
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
