export interface NormalizedNote {
  noteId: string;
  title: string;
  desc: string;
  author: string;
  authorId: string;
  cover: string;
  images: string[];
  href: string;
  likes: number;
  commentsCount: number;
  collects: number;
  xsecToken: string;
  sourceUrl: string;
}

export interface NoteDetail {
  noteId: string;
  title: string;
  desc: string;
  author: string;
  authorId: string;
  images: string[];
  tags: string[];
  publishTime: string;
  ipLocation: string;
}

export interface NoteComment {
  id: string;
  name: string;
  text: string;
  avatar: string;
  likes: number;
  time: string;
  subComments: NoteComment[];
}

const NOTE_ID_KEYS = ['note_id', 'id', 'noteId'];
const TITLE_KEYS = ['display_title', 'title', 'note_title', 'desc'];
const COVER_KEYS = ['cover', 'image_list', 'images_list', 'image'];
const USER_KEYS = ['user', 'author', 'user_info', 'note_user', 'userInfo'];

interface UnknownObj {
  [key: string]: unknown;
}

export function scanForNotes(obj: unknown, sourceUrl: string): NormalizedNote[] {
  const found: NormalizedNote[] = [];
  const seenIds = new Set<string>();

  recursiveScan(obj, 0);

  return found;

  function recursiveScan(target: unknown, depth: number): void {
    if (depth > 10) return;
    if (!target || typeof target !== 'object') return;

    if (Array.isArray(target)) {
      for (const item of target) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          if (looksLikeNote(item as UnknownObj)) {
            const note = normalizeNote(item as UnknownObj, sourceUrl);
            if (note && !seenIds.has(note.noteId)) {
              seenIds.add(note.noteId);
              found.push(note);
            }
          } else {
            recursiveScan(item, depth + 1);
          }
        }
      }
      return;
    }

    if (looksLikeNote(target as UnknownObj)) {
      const note = normalizeNote(target as UnknownObj, sourceUrl);
      if (note && !seenIds.has(note.noteId)) {
        seenIds.add(note.noteId);
        found.push(note);
      }
      return;
    }

    const obj = target as UnknownObj;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        recursiveScan(val, depth + 1);
      }
    }
  }
}

function looksLikeNote(obj: UnknownObj): boolean {
  let score = 0;
  const flat = flattenKeys(obj);

  for (const k of NOTE_ID_KEYS) {
    if (flat.has(k)) { score += 3; break; }
  }
  for (const k of TITLE_KEYS) {
    if (flat.has(k)) { score += 2; break; }
  }
  for (const k of COVER_KEYS) {
    if (flat.has(k)) { score += 2; break; }
  }
  for (const k of USER_KEYS) {
    if (flat.has(k)) { score += 2; break; }
  }

  return score >= 5;
}

function flattenKeys(obj: UnknownObj, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const k of Object.keys(obj)) {
    keys.add(k);
    const val = obj[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = flattenKeys(val as UnknownObj, prefix + k + '.');
      for (const nk of nested) keys.add(nk);
    }
  }
  return keys;
}

function normalizeNote(obj: UnknownObj, sourceUrl: string): NormalizedNote | null {
  const noteId = pickFirst(obj, NOTE_ID_KEYS);
  if (!noteId || typeof noteId !== 'string') return null;

  const title = pickFirstStr(obj, TITLE_KEYS) || '';
  const author = extractAuthor(obj);
  const cover = pickFirstStr(obj, COVER_KEYS) || extractFirstImage(obj);
  const xsecToken = pickFirstStr(obj, ['xsec_token', 'xsecToken']) || '';

  const interactInfo = obj.interact_info || obj.interactInfo || obj.interaction || {};
  const likes = numVal((interactInfo as UnknownObj).liked_count ?? (interactInfo as UnknownObj).likes ?? 0);
  const commentsCount = numVal((interactInfo as UnknownObj).comment_count ?? (interactInfo as UnknownObj).comments ?? 0);
  const collects = numVal((interactInfo as UnknownObj).collected_count ?? (interactInfo as UnknownObj).collects ?? 0);

  const images = extractImageList(obj);
  const href = buildHref(noteId, xsecToken);

  return {
    noteId,
    title: (title || noteId).slice(0, 80),
    desc: pickFirstStr(obj, ['desc', 'description', 'content']) || '',
    author,
    authorId: extractAuthorId(obj),
    cover,
    images: images.length ? images : (cover ? [cover] : []),
    href,
    likes,
    commentsCount,
    collects,
    xsecToken,
    sourceUrl,
  };
}

function extractAuthor(obj: UnknownObj): string {
  const user = findInTree(obj, USER_KEYS);
  if (!user || typeof user !== 'object') return '';

  const u = user as UnknownObj;
  return pickFirstStr(u, ['nickname', 'nick_name', 'name', 'user_nickname']) || '';
}

function extractAuthorId(obj: UnknownObj): string {
  const user = findInTree(obj, USER_KEYS);
  if (!user || typeof user !== 'object') return '';

  const u = user as UnknownObj;
  return pickFirstStr(u, ['user_id', 'userId', 'id', 'red_id', 'xsec_user_id']) || '';
}

function extractImageList(obj: UnknownObj): string[] {
  const candidates = [
    obj.image_list,
    obj.images_list,
    obj.images,
    obj.imageList,
    obj.imagesList,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return (item as UnknownObj).url || (item as UnknownObj).url_default || (item as UnknownObj).info_list?.[0]?.url || '';
        }
        return '';
      }).filter(Boolean);
    }
  }

  return [];
}

function extractFirstImage(obj: UnknownObj): string {
  return pickFirstStr(obj, ['image', 'img', 'thumbnail', 'thumb']) || '';
}

function buildHref(noteId: string, xsecToken: string): string {
  const base = '/explore/' + noteId;
  if (xsecToken) return base + '?xsec_token=' + encodeURIComponent(xsecToken);
  return base;
}

function pickFirst(obj: UnknownObj, keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj) return obj[k];
  }
  return null;
}

function pickFirstStr(obj: UnknownObj, keys: string[]): string {
  const val = pickFirst(obj, keys);
  return typeof val === 'string' ? val : '';
}

function findInTree(obj: UnknownObj, keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj) return obj[k];
  }
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const found = findInTree(val as UnknownObj, keys);
      if (found !== null) return found;
    }
  }
  return null;
}

function numVal(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function parseApiComments(body: unknown): NoteComment[] {
  if (!body || typeof body !== 'object') return [];

  const obj = body as UnknownObj;
  const data = obj.data || obj;

  const directComments =
    (data as UnknownObj).comments ||
    (data as UnknownObj).comment_list ||
    (data as UnknownObj).commentList ||
    (data as UnknownObj).list ||
    [];

  const comments = Array.isArray(directComments) ? directComments : findCommentArray(data);
  if (!comments.length) return [];

  return comments.slice(0, 30).map((c: unknown) => parseComment(c as UnknownObj));
}

export function parseApiDetail(body: unknown, sourceUrl: string): NoteDetail | null {
  const notes = scanForNotes(body, sourceUrl);
  const note = notes[0];
  if (!note) return null;

  const raw = findRawNote(body);
  const tags = raw ? extractTags(raw) : [];

  return {
    noteId: note.noteId,
    title: note.title,
    desc: note.desc,
    author: note.author,
    authorId: note.authorId,
    images: note.images,
    tags,
    publishTime: raw ? pickFirstStr(raw, ['time', 'publish_time', 'publishTime', 'last_update_time']) : '',
    ipLocation: raw ? pickFirstStr(raw, ['ip_location', 'ipLocation']) : '',
  };
}

function parseComment(c: UnknownObj): NoteComment {
  const userInfo = (c.user_info || c.user || c.author || {}) as UnknownObj;

  const subComments: NoteComment[] = [];
  const subList = c.sub_comments || c.sub_comment_list || c.replies || [];
  if (Array.isArray(subList)) {
    for (const sc of subList.slice(0, 5)) {
      subComments.push(parseComment(sc as UnknownObj));
    }
  }

  return {
    id: pickFirstStr(c, ['id', 'comment_id', 'commentId']) || '',
    name: pickFirstStr(userInfo, ['nickname', 'nick_name', 'name']) || '',
    text: extractCommentText(c),
    avatar: pickFirstStr(userInfo, ['avatar', 'image', 'avatar_url']) || '',
    likes: numVal(c.like_count ?? c.likes ?? 0),
    time: pickFirstStr(c, ['create_time', 'time', 'created_at']) || '',
    subComments,
  };
}

function findCommentArray(target: unknown, depth = 0): UnknownObj[] {
  if (depth > 8 || !target || typeof target !== 'object') return [];

  if (Array.isArray(target)) {
    const objects = target.filter((item): item is UnknownObj =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
    );
    if (objects.length > 0 && objects.some(looksLikeComment)) return objects;

    for (const item of target) {
      const found = findCommentArray(item, depth + 1);
      if (found.length) return found;
    }
    return [];
  }

  const obj = target as UnknownObj;
  for (const key of Object.keys(obj)) {
    const found = findCommentArray(obj[key], depth + 1);
    if (found.length) return found;
  }

  return [];
}

function looksLikeComment(obj: UnknownObj): boolean {
  const hasId = Boolean(pickFirstStr(obj, ['id', 'comment_id', 'commentId']));
  const hasText = Boolean(extractCommentText(obj));
  const hasUser = Boolean(obj.user_info || obj.user || obj.author);
  return hasText && (hasId || hasUser);
}

function extractCommentText(obj: UnknownObj): string {
  const text = pickFirstStr(obj, ['content', 'text', 'comment', 'content_text']);
  if (text) return text;

  const content = obj.content;
  if (content && typeof content === 'object') {
    return pickFirstStr(content as UnknownObj, ['text', 'content', 'value']);
  }

  return '';
}

function findRawNote(target: unknown, depth = 0): UnknownObj | null {
  if (depth > 10 || !target || typeof target !== 'object') return null;

  if (Array.isArray(target)) {
    for (const item of target) {
      const found = findRawNote(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const obj = target as UnknownObj;
  if (looksLikeNote(obj)) return obj;

  for (const key of Object.keys(obj)) {
    const found = findRawNote(obj[key], depth + 1);
    if (found) return found;
  }

  return null;
}

function extractTags(obj: UnknownObj): string[] {
  const rawTags = obj.tag_list || obj.tags || obj.hash_tag || [];
  if (!Array.isArray(rawTags)) return [];

  return rawTags.map((tag) => {
    if (typeof tag === 'string') return tag;
    if (tag && typeof tag === 'object') {
      return pickFirstStr(tag as UnknownObj, ['name', 'tag_name', 'title']);
    }
    return '';
  }).filter(Boolean).slice(0, 20);
}
