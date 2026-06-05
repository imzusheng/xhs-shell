import { NATIVE_PEEK_DURATION_MS } from '../constants';
import { getState, saveState, setRootState } from '../state';

let nativeVisibleTimer = 0;

export function peekNative(): void {
  const state = getState();
  state.nativeVisible = true;
  saveState();
  setRootState();

  clearTimeout(nativeVisibleTimer);
  nativeVisibleTimer = window.setTimeout(() => {
    state.nativeVisible = false;
    saveState();
    setRootState();
  }, NATIVE_PEEK_DURATION_MS);
}
