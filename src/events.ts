import { IDS } from './constants';
import { byId } from './utils/dom';
import { getState, saveState, setRootState, applyAppState, applyPanelSize } from './state';
import { peekNative } from './services/native-bridge';
import { resetSearch, clearSearch, doSearch } from './services/search';
import { scanNativeCards } from './services/card-scanner';
import { renderList, setSelectedId, bumpDetailLoadToken } from './panels/list-panel';
import { renderDetail, renderDetailLoading, renderRightEmpty } from './panels/detail-panel';
import { renderRightCurrent, setActiveTab } from './panels/right-panel';
import { loadDetailInHiddenFrame } from './services/detail-loader';
import type { Card } from './services/card-scanner';
import type { Detail } from './services/detail-loader';

const IMAGE_MODES = ['terminal', 'issue', 'blur', 'normal'] as const;

export function toast(text: string): void {
  const node = byId(IDS.toast);
  if (!node) return;

  node.textContent = text;
  node.className = 'wb-toast show';

  clearTimeout((node as unknown as Record<string, number>)._timer);
  (node as unknown as Record<string, number>)._timer = window.setTimeout(() => {
    node.className = 'wb-toast';
  }, 1300);
}

function onTagClick(tag: string): void {
  doSearch(tag);
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
    console.warn('[XHS Workbench Shell] hidden frame detail failed', err);
    renderDetail({
      title: item.title,
      desc: item.rawText || item.desc,
      author: item.author,
      href: item.href,
      images: item.image ? [item.image] : [],
      comments: [],
      source: 'fallback-card-no-refresh',
    });
  });
}

function toggleEnabled(): void {
  const state = getState();
  state.enabled = !state.enabled;
  saveState();
  setRootState();
  applyAppState();
  toast('Workbench shell: ' + (state.enabled ? 'ON' : 'OFF'));
}

function cycleImageMode(): void {
  const state = getState();
  const idx = IMAGE_MODES.indexOf(state.imageMode);
  state.imageMode = IMAGE_MODES[(idx + 1) % IMAGE_MODES.length] || 'terminal';
  saveState();
  setRootState();
  applyAppState();
  toast('Image mode: ' + state.imageMode);
}

export function bindAppEvents(): void {
  byId(IDS.toggleBtn)?.addEventListener('click', toggleEnabled);
  byId(IDS.imageBtn)?.addEventListener('click', cycleImageMode);

  byId(IDS.refreshBtn)?.addEventListener('click', () => {
    resetSearch();
    scanNativeCards(true);
    renderList(openShellDetail, onTagClick);
    toast('Rescanned native DOM');
  });

  byId(IDS.nativeBtn)?.addEventListener('click', () => {
    peekNative();
    toast('Native page visible for 5s');
  });

  byId(IDS.searchBtn)?.addEventListener('click', () => {
    const input = byId(IDS.searchInput) as HTMLInputElement | null;
    if (input) doSearch(input.value.trim());
  });

  byId(IDS.clearBtn)?.addEventListener('click', () => {
    clearSearch();
    scanNativeCards(true);
    renderList(openShellDetail, onTagClick);
  });

  byId(IDS.searchInput)?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      const input = byId(IDS.searchInput) as HTMLInputElement | null;
      if (input) doSearch(input.value.trim());
    }
  });

  byId(IDS.closeDetail)?.addEventListener('click', () => {
    setSelectedId('');
    renderRightEmpty();
    renderList(openShellDetail, onTagClick);
  });

  document.querySelectorAll<HTMLElement>('#' + IDS.app + ' .wb-tab-small').forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode') || 'detail';
      setActiveTab(mode);
      renderRightCurrent();
    });
  });
}

export function bindGlobalEvents(): void {
  document.addEventListener('keydown', (e) => {
    const app = byId(IDS.app);

    if (e.altKey && app) {
      app.classList.add('peek');
    }

    if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
      e.preventDefault();
      toggleEnabled();
    }

    if (e.ctrlKey && e.shiftKey && e.code === 'KeyI') {
      e.preventDefault();
      cycleImageMode();
    }

    if (e.ctrlKey && e.shiftKey && e.code === 'KeyN') {
      e.preventDefault();
      peekNative();
      toast('Native page visible for 5s');
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    const app = byId(IDS.app);
    if (!e.altKey && app) {
      app.classList.remove('peek');
    }
  }, true);

  window.addEventListener('blur', () => {
    const app = byId(IDS.app);
    if (app) app.classList.remove('peek');
  }, false);

  window.addEventListener('resize', () => {
    applyPanelSize();
    saveState();
  }, false);
}
