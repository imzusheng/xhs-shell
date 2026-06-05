import type { NormalizedNote, NoteDetail, NoteComment } from './normalizer';

interface NoteStore {
  feedNotes: NormalizedNote[];
  searchNotes: NormalizedNote[];
  detailCache: Record<string, NoteDetail>;
  commentCache: Record<string, NoteComment[]>;
  lastUpdate: number;
}

const store: NoteStore = {
  feedNotes: [],
  searchNotes: [],
  detailCache: {},
  commentCache: {},
  lastUpdate: 0,
};

let captureLog: CaptureEntry[] = [];
const MAX_LOG = 50;
let onUpdated: (() => void) | null = null;

export interface CaptureEntry {
  url: string;
  method: string;
  status: number;
  noteCount: number;
  commentCount: number;
  ts: number;
}

export function setOnUpdated(cb: () => void): void {
  onUpdated = cb;
}

export function pushCaptureLog(entry: CaptureEntry): void {
  captureLog.unshift(entry);
  if (captureLog.length > MAX_LOG) captureLog.pop();
}

export function getCaptureLog(): CaptureEntry[] {
  return captureLog;
}

export function setFeedNotes(notes: NormalizedNote[]): void {
  store.feedNotes = dedupeNotes(notes);
  store.lastUpdate = Date.now();
  notify();
}

export function addFeedNotes(notes: NormalizedNote[]): void {
  const merged = [...store.feedNotes, ...notes];
  store.feedNotes = dedupeNotes(merged);
  store.lastUpdate = Date.now();
  notify();
}

export function setSearchNotes(notes: NormalizedNote[]): void {
  store.searchNotes = dedupeNotes(notes);
  store.lastUpdate = Date.now();
  notify();
}

export function getFeedNotes(): NormalizedNote[] {
  return store.feedNotes;
}

export function getSearchNotes(): NormalizedNote[] {
  return store.searchNotes;
}

export function getActiveNotes(): NormalizedNote[] {
  return store.searchNotes.length ? store.searchNotes : store.feedNotes;
}

export function cacheDetail(noteId: string, detail: NoteDetail): void {
  store.detailCache[noteId] = detail;
  notify();
}

export function getCachedDetail(noteId: string): NoteDetail | null {
  return store.detailCache[noteId] || null;
}

export function cacheComments(noteId: string, comments: NoteComment[]): void {
  store.commentCache[noteId] = comments;
  notify();
}

export function getCachedComments(noteId: string): NoteComment[] {
  return store.commentCache[noteId] || [];
}

export function getLastUpdate(): number {
  return store.lastUpdate;
}

export function hasAnyNotes(): boolean {
  return store.feedNotes.length > 0 || store.searchNotes.length > 0;
}

function notify(): void {
  if (onUpdated) {
    try { onUpdated(); } catch { /* ignore */ }
  }
}

function dedupeNotes(notes: NormalizedNote[]): NormalizedNote[] {
  const seen = new Set<string>();
  return notes.filter((n) => {
    if (seen.has(n.noteId)) return false;
    seen.add(n.noteId);
    return true;
  });
}
