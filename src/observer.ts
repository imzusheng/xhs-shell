import { SCAN_DEBOUNCE_MS, URL_WATCH_INTERVAL_MS, IDS } from './constants';
import { getIsListLoading } from './services/search';
import { scanNativeCards, getCards } from './services/card-scanner';
import { renderList } from './panels/list-panel';
import { applyAppState } from './state';

let scanTimer = 0;
let lastUrl = location.href;
let lastCardsHash = '';

export function observeNativePage(
  openDetailCb: (item: import('./services/card-scanner').Card) => void,
  onTagClick: (tag: string) => void,
): void {
  if (!window.MutationObserver || !document.body) {
    setInterval(() => {
      if (!getIsListLoading()) {
        scanAndRender(openDetailCb, onTagClick);
      }
    }, 2000);
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const onlyShellChanges = mutations.every((m) => {
      const target = m.target as Element;
      return target?.closest?.('#' + IDS.app);
    });

    if (onlyShellChanges) return;

    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      if (!getIsListLoading()) {
        scanAndRender(openDetailCb, onTagClick);
      }
    }, SCAN_DEBOUNCE_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        if (!getIsListLoading()) {
          scanAndRender(openDetailCb, onTagClick);
          applyAppState();
        }
      }, URL_WATCH_INTERVAL_MS);
    }
  }, URL_WATCH_INTERVAL_MS);
}

function scanAndRender(
  openDetailCb: (item: import('./services/card-scanner').Card) => void,
  onTagClick: (tag: string) => void,
): void {
  scanNativeCards(false);

  const cards = getCards();
  const hash = cards.map((c) => c.id).join(',');
  if (hash === lastCardsHash) return;
  lastCardsHash = hash;

  renderList(openDetailCb, onTagClick);
}
