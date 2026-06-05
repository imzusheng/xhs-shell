import { IDS, KEY, DEFAULT_STATE, VERSION } from './constants';
import type { ImageMode } from './constants';
import { byId, setText } from './utils/dom';

interface ShellState {
  enabled: boolean;
  imageMode: ImageMode;
  nativeVisible: boolean;
  rightMode: string;
  query: string;
  explorerWidth: number;
  rightWidth: number;
}

let state: ShellState;

function loadState(): ShellState {
  const base = { ...DEFAULT_STATE };

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k of Object.keys(base) as (keyof ShellState)[]) {
      if (typeof saved[k] !== 'undefined') {
        (base as Record<string, unknown>)[k] = saved[k];
      }
    }
  } catch {
    // ignore
  }

  state = base;
  return base;
}

function saveState(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function setRootState(): void {
  const root = document.documentElement;
  root.setAttribute('data-xhs-wb4', state.enabled ? 'on' : 'off');
  root.setAttribute('data-xhs-wb4-image', state.imageMode);
  root.setAttribute('data-xhs-wb4-native-visible', state.nativeVisible ? 'on' : 'off');
}

function getState(): ShellState {
  return state;
}

function applyPanelSize(): void {
  const app = byId(IDS.app);
  if (!app) return;

  const viewportW = window.innerWidth || 1440;
  state.explorerWidth = clamp(state.explorerWidth, 160, 380);
  state.rightWidth = clamp(state.rightWidth, 360, Math.max(380, viewportW - 620));

  app.style.setProperty('--explorer-w', state.explorerWidth + 'px');
  app.style.setProperty('--right-w', state.rightWidth + 'px');
}

function applyAppState(): void {
  const app = byId(IDS.app);
  if (app) {
    app.setAttribute('data-image', state.imageMode);
  }
  applyPanelSize();

  setText(IDS.imageLabel, 'image: ' + state.imageMode);
  setText(IDS.toggleBtn, state.enabled ? 'Hide' : 'Show');
  setText(IDS.routeLabel, getRoute() + '()');
  setText(IDS.statusLeft, 'main ● TypeScript ● UTF-8 ● Spaces: 2 ● ' + getRoute() + '.service.ts');

  const cardsLen = (window as unknown as Record<string, unknown>).__xhs_cards_len ?? 0;
  setText(IDS.statusRight, 'cards:' + cardsLen + ' ● right:' + state.rightWidth + 'px ● shell:v' + VERSION);
}

function getRoute(): string {
  const path = location.pathname.replace(/^\//, '') || 'explore';
  return path
    .replace(/[^a-zA-Z0-9_/-]/g, '_')
    .replace(/\//g, '.') || 'explore';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export {
  loadState,
  saveState,
  setRootState,
  getState,
  applyPanelSize,
  applyAppState,
  getRoute,
  clamp,
};
export type { ShellState };
