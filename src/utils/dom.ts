export function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function setText(id: string, text: string): void {
  const node = byId(id);
  if (node) node.textContent = text;
}

export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });
}

export function escapeAttr(v: unknown): string {
  return escapeHtml(v).replace(/`/g, '&#96;');
}

export function safeRect(node: Element): DOMRect | null {
  try {
    return node.getBoundingClientRect();
  } catch {
    return null;
  }
}

export function getCleanText(node: Element | null): string {
  if (!node) return '';
  return String((node as HTMLElement).innerText || node.textContent || '')
    .replace(/\u200b/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

export function splitLines(text: string): string[] {
  return String(text || '')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length < 180);
}

export function pad(v: unknown, size: number): string {
  let out = String(v);
  while (out.length < size) out = '0' + out;
  return out;
}
