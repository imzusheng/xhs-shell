import { BRIDGE_MSG_KEY } from '../constants';
import { scanForNotes, parseApiComments, parseApiDetail } from './normalizer';
import {
  setFeedNotes,
  addFeedNotes,
  setSearchNotes,
  pushCaptureLog,
  cacheComments,
  cacheDetail,
} from './note-store';

interface BridgeMessage {
  __xhs_wb5_bridge: boolean;
  type: string;
  url: string;
  method: string;
  status: number;
  body: unknown;
  requestBody?: unknown;
  ts: number;
  via: string;
}

export function initNetworkBridge(): void {
  window.addEventListener('message', handleBridgeMessage, false);
  console.log('[XHS Workbench Shell V5] NetworkBridge listening');
}

function handleBridgeMessage(event: MessageEvent): void {
  const msg = event.data as BridgeMessage | undefined;
  if (!msg?.__xhs_wb5_bridge) return;

  // count every message for debugging
  const mc = ((window as unknown as Record<string, number>).__xhs_msg_count || 0) + 1;
  (window as unknown as Record<string, number>).__xhs_msg_count = mc;
  if (mc <= 5) {
    console.log('[WB5 msg#' + mc + ']', msg.type, msg.via || '', (msg.url || '').slice(0, 60));
  }

  // pre-request diagnostic: log every fetch/XHR call (up to 50)
  if (msg.type === 'api-request') {
    pushCaptureLog({
      url: String(msg.url || '').slice(0, 100),
      method: String(msg.via || 'req'),
      status: 0,
      noteCount: 0,
      commentCount: 0,
      ts: Date.now(),
    });
    return;
  }

  if (msg.type !== 'api-response') return;

  const url = String(msg.url || '');
  const method = String(msg.method || 'GET');
  const status = Number(msg.status || 0);
  const body = msg.body;
  const requestBody = msg.requestBody;

  if (!body) return;

  const notes = scanForNotes(body, url);
  const comments = parseApiComments(body);
  const detail = looksLikeDetailRequest(url, requestBody) ? parseApiDetail(body, url) : null;

  const isSearch = /search/i.test(url);
  const isFeed = /feed|homefeed|explore/i.test(url);
  const isComment = /comment/i.test(url);

  // log response structure every time (up to 3)
  if ((isFeed || isSearch || isComment) && !(window as unknown as Record<string, number>).__xhs_dump_n) {
    const n = (window as unknown as Record<string, number>).__xhs_dump_n || 0;
    (window as unknown as Record<string, number>).__xhs_dump_n = n + 1;
    dumpStructure(body, url, n + 1);
  }

  if (isSearch && notes.length > 0) {
    setSearchNotes(notes);
  } else if (isFeed && notes.length > 0) {
    if (url.includes('cursor') || method === 'POST') {
      addFeedNotes(notes);
    } else {
      setFeedNotes(notes);
    }
  }

  if (isComment && comments.length > 0) {
    const noteId = extractNoteId(url, requestBody);
    if (noteId) {
      cacheComments(noteId, comments);
    }
  }

  if (detail) {
    cacheDetail(detail.noteId, detail);
  }

  if (notes.length > 0 || comments.length > 0 || detail) {
    pushCaptureLog({
      url: url.replace(/^https?:\/\/[^/]+/, ''),
      method,
      status,
      noteCount: notes.length,
      commentCount: comments.length,
      ts: Date.now(),
    });

    console.log(
      '[XHS Workbench Shell] captured: ' +
      notes.length + ' notes, ' + comments.length + ' comments | ' +
      extractPath(url),
    );
  }
}

function extractNoteId(url: string, requestBody: unknown): string {
  const fromBody = extractNoteIdFromObject(requestBody);
  if (fromBody) return fromBody;

  const m = url.match(/note[_-]?id[=:/\s]*([a-zA-Z0-9]+)/i) ||
    url.match(/\/([a-zA-Z0-9]{20,})\//);
  return m?.[1] || '';
}

function extractNoteIdFromObject(value: unknown): string {
  if (!value || typeof value !== 'object') return '';

  const obj = value as Record<string, unknown>;
  const direct = obj.note_id || obj.noteId || obj.source_note_id || obj.sourceNoteId || obj.id;
  if (typeof direct === 'string' && direct.length >= 10) return direct;

  for (const key of Object.keys(obj)) {
    const nested = obj[key];
    if (nested && typeof nested === 'object') {
      const found = extractNoteIdFromObject(nested);
      if (found) return found;
    }
  }

  return '';
}

function extractPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/api\/sns\/web\//, '');
  } catch {
    return url.slice(0, 80);
  }
}

function looksLikeDetailRequest(url: string, requestBody: unknown): boolean {
  if (/\/note\/|\/detail|\/single|\/web\/v2\/note\/page|note_id=|source_note_id=/i.test(url)) {
    return true;
  }

  return /\/feed/i.test(url) && Boolean(extractNoteIdFromObject(requestBody));
}

function dumpStructure(body: unknown, url: string, n: number): void {
  if (!body || typeof body !== 'object') {
    console.log('[dump#' + n + '] not an object, type:', typeof body);
    return;
  }
  const obj = body as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, 20);
  console.log('[dump#' + n + '] keys:', keys.join(', '));

  let found = false;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) {
      console.log('[dump#' + n + '] array ' + k + ' len=' + v.length, 'item keys:', Object.keys(v[0] || {}).slice(0, 15).join(', '));
      found = true;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sub = v as Record<string, unknown>;
      for (const sk of Object.keys(sub).slice(0, 10)) {
        const sv = sub[sk];
        if (Array.isArray(sv) && sv.length > 0) {
          console.log('[dump#' + n + '] array ' + k + '.' + sk + ' len=' + sv.length, 'item keys:', Object.keys(sv[0] || {}).slice(0, 15).join(', '));
          found = true;
        }
      }
    }
  }
  if (!found) {
    console.log('[dump#' + n + '] no arrays found in direct keys');
    console.log('[dump#' + n + '] raw top-level sample:', JSON.stringify(obj).slice(0, 300));
  }
}

/**
 * 解析页面 SSR 注入的 __INITIAL_STATE__，拿首屏笔记。
 * 首屏笔记很多时候不走接口，直接塞在 HTML 里。
 */
export function parseInitialState(): void {
  try {
    const win = window as unknown as Record<string, unknown>;
    const state = win.__INITIAL_STATE__;
    if (!state || typeof state !== 'object') {
      console.log('[XHS Workbench Shell] no __INITIAL_STATE__ on window');
      return;
    }

    const notes = scanForNotes(state, 'window.__INITIAL_STATE__');
    if (notes.length > 0) {
      setFeedNotes(notes);
      pushCaptureLog({
        url: 'window.__INITIAL_STATE__',
        method: 'SSR',
        status: 200,
        noteCount: notes.length,
        commentCount: 0,
        ts: Date.now(),
      });
      console.log('[XHS Workbench Shell] parsed ' + notes.length + ' notes from __INITIAL_STATE__');
    } else {
      console.log('[XHS Workbench Shell] __INITIAL_STATE__ present but no notes found');
    }
  } catch (err) {
    console.warn('[XHS Workbench Shell] parseInitialState failed', err);
  }
}
