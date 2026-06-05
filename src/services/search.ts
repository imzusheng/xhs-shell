import { IDS, SEARCH_TIMEOUT_MS, SEARCH_POLL_INTERVAL_MS } from '../constants';
import { getState, saveState } from '../state';
import { byId } from '../utils/dom';
import { getCards, setCards, scanNativeCards, type Card } from './card-scanner';

let activeSearchToken = 0;
let isListLoading = false;

export function getIsListLoading(): boolean {
  return isListLoading;
}

export function resetSearch(): void {
  activeSearchToken += 1;
  isListLoading = false;
}

export function clearSearch(): void {
  activeSearchToken += 1;
  isListLoading = false;
  const state = getState();
  state.query = '';
  saveState();

  const input = byId(IDS.searchInput) as HTMLInputElement | null;
  if (input) input.value = '';
}

export function doSearch(query: string): void {
  const state = getState();
  state.query = query;
  saveState();

  if (!query) {
    activeSearchToken += 1;
    isListLoading = false;
    scanNativeCards(true);
    return;
  }

  activeSearchToken += 1;
  const token = activeSearchToken;
  isListLoading = true;
  setCards([]);

  simulateNativeSearch(query);
  waitForNativeSearchResults(token, query);
}

function waitForNativeSearchResults(token: number, q: string): void {
  const start = Date.now();

  function tick(): void {
    if (token !== activeSearchToken) return;

    const count = scanNativeCards(false);
    if (count > 0) {
      isListLoading = false;
      return;
    }

    if (Date.now() - start > SEARCH_TIMEOUT_MS) {
      isListLoading = false;
      scanNativeCards(true);
      return;
    }

    setTimeout(tick, SEARCH_POLL_INTERVAL_MS);
  }

  setTimeout(tick, SEARCH_POLL_INTERVAL_MS + 100);
}

function simulateNativeSearch(q: string): void {
  const nativeInput = findNativeSearchInput();
  if (nativeInput) {
    try {
      setNativeInputValue(nativeInput, q);
      nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
      nativeInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
      nativeInput.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
      return;
    } catch { /* fall through */ }
  }
  navigateToSearch(q);
}

function navigateToSearch(q: string): void {
  const url = '/search_result?keyword=' + encodeURIComponent(q) + '&source=web_search_result_notes';
  try {
    if (location.pathname.includes('/search_result')) {
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      location.href = url;
    }
  } catch {
    location.href = url;
  }
}

function findNativeSearchInput(): HTMLInputElement | null {
  const inputs = document.querySelectorAll('input');
  let found: HTMLInputElement | null = null;

  inputs.forEach((input) => {
    if (found || (input.closest && input.closest('#' + IDS.app))) return;
    const ph = input.getAttribute('placeholder') || '';
    const value = input.value || '';
    if (/搜索|搜|search/i.test(ph + ' ' + value)) found = input;
  });

  return found;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(input) as HTMLInputElement;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) {
    desc.set.call(input, value);
  } else {
    input.value = value;
  }
}
