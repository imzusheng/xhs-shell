export function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return 'note_' + Math.abs(h);
}

export function canonicalNoteKey(href: string): string {
  const raw = String(href || '');

  try {
    const url = new URL(raw, location.origin);
    const path = url.pathname;

    const matchExplore = path.match(/\/explore\/([^/?#]+)/);
    const matchSearch = path.match(/\/search_result\/([^/?#]+)/);
    const matchDiscovery = path.match(/\/discovery\/item\/([^/?#]+)/);

    if (matchExplore?.[1]) return 'note:' + matchExplore[1];
    if (matchSearch?.[1]) return 'note:' + matchSearch[1];
    if (matchDiscovery?.[1]) return 'note:' + matchDiscovery[1];

    return 'href:' + path + ':' + (url.searchParams.get('xsec_token') || '');
  } catch {
    return 'href:' + raw.split('?')[0].split('#')[0];
  }
}
