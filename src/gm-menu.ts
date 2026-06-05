import { getState, saveState, applyPanelSize, applyAppState } from './state';
import { resetSearch } from './services/search';
import { scanNativeCards } from './services/card-scanner';
import { renderList } from './panels/list-panel';

export function registerMenu(
  openDetailCb: (item: import('./services/card-scanner').Card) => void,
  onTagClick: (tag: string) => void,
): void {
  if (typeof GM_registerMenuCommand !== 'function') return;

  GM_registerMenuCommand('开关壳层 Ctrl+Shift+X', () => {
    const state = getState();
    state.enabled = !state.enabled;
    saveState();
    // setRootState handled by caller
  });

  GM_registerMenuCommand('切换详情图片弱化 Ctrl+Shift+I', () => {
    const modes = ['terminal', 'issue', 'blur', 'normal'] as const;
    const state = getState();
    const idx = modes.indexOf(state.imageMode);
    state.imageMode = modes[(idx + 1) % modes.length] || 'terminal';
    saveState();
  });

  GM_registerMenuCommand('原生页面预览 Ctrl+Shift+N', () => {
    const state = getState();
    state.nativeVisible = true;
    saveState();
    setTimeout(() => {
      state.nativeVisible = false;
      saveState();
    }, 5000);
  });

  GM_registerMenuCommand('重新扫描原生卡片', () => {
    resetSearch();
    scanNativeCards(true);
    renderList(openDetailCb, onTagClick);
  });

  GM_registerMenuCommand('重置面板宽度', () => {
    const state = getState();
    state.explorerWidth = 240;
    state.rightWidth = 520;
    saveState();
    applyPanelSize();
    applyAppState();
  });
}

declare function GM_registerMenuCommand(name: string, fn: () => void): void;
