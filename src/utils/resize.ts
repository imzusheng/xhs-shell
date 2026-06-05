import { IDS } from '../constants';
import { getState, applyPanelSize, saveState, clamp } from '../state';
import { byId } from './dom';

export function bindResizeEvents(): void {
  bindResizer(IDS.resizerExplorer, 'explorer');
  bindResizer(IDS.resizerRight, 'right');
}

function bindResizer(id: string, type: 'explorer' | 'right'): void {
  const handle = byId(id);
  if (!handle) return;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();

    const app = byId(IDS.app);
    const state = getState();
    const startX = e.clientX;
    const startExplorer = Number(state.explorerWidth) || 240;
    const startRight = Number(state.rightWidth) || 520;

    handle.classList.add('active');
    if (app) app.classList.add('resizing');

    function onMove(ev: MouseEvent): void {
      const dx = ev.clientX - startX;
      if (type === 'explorer') {
        state.explorerWidth = clamp(startExplorer + dx, 160, 380);
      }
      if (type === 'right') {
        const viewport = window.innerWidth || document.documentElement.clientWidth || 1440;
        state.rightWidth = clamp(startRight - dx, 360, Math.max(380, viewport - 620));
      }
      applyPanelSize();
    }

    function onUp(): void {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      handle.classList.remove('active');
      if (app) app.classList.remove('resizing');
      saveState();
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  }, false);
}
