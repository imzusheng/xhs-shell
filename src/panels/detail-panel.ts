import { IDS } from '../constants';
import { escapeHtml, escapeAttr, setText } from '../utils/dom';
import { shortHref } from './list-panel';
import { getCards } from '../services/card-scanner';
import type { Card } from '../services/card-scanner';
import type { Detail } from '../services/detail-loader';

export function renderDetailLoading(item: Card): void {
  setText(IDS.rightTitle, 'DETAIL PANEL · loading');
  setActiveTabStyle('detail');

  const body = document.getElementById(IDS.rightBody);
  if (!body) return;

  body.innerHTML = [
    '<div class="wb-detail-title">' + escapeHtml(item.title) + '</div>',
    '<div class="wb-detail-meta">',
      '<span class="wb-pill">loading via native click + bridge</span>',
      '<span class="wb-pill">wait for XHS API</span>',
      '<span class="wb-pill">' + escapeHtml(shortHref(item.href)) + '</span>',
    '</div>',
    '<div class="wb-loading">',
      '<div class="wb-spinner"></div>',
      '<div style="flex:1;min-width:0;">',
        '<div class="blue">await nativeDetail("' + escapeHtml(shortHref(item.href)) + '")</div>',
        '<div class="muted">正在触发小红书原生详情，等待 NetworkBridge 捕获接口数据。</div>',
        '<div class="wb-skeleton" style="width:92%;"></div>',
        '<div class="wb-skeleton" style="width:78%;"></div>',
        '<div class="wb-skeleton" style="width:64%;"></div>',
      '</div>',
    '</div>',
    '<div class="wb-console">',
      '<span class="green">[native]</span> click ' + shortHref(item.href) + '\n',
      '<span class="yellow">[bridge]</span> wait detail/comment API\n',
      '<span class="yellow">[cache]</span> render captured data\n',
      '<span class="muted">[fallback]</span> if XHS requires login, show card only',
    '</div>',
  ].join('');
}

export function renderDetail(detail: Detail): void {
  const isRestricted = detail.source === 'iframe-restricted' || detail.source === 'iframe-timeout';
  const isLoginRequired = detail.source === 'login-required';
  setText(IDS.rightTitle, 'DETAIL PANEL · ' + detail.source);
  setActiveTabStyle('detail');

  const body = document.getElementById(IDS.rightBody);
  if (!body) return;

  let media = '';
  if (detail.images?.length) {
    media = '<div class="wb-detail-media">' +
      detail.images.map((src) =>
        '<img src="' + escapeAttr(src) + '" title="hover: original image; click: open image in new tab" />'
      ).join('') +
    '</div>';
  }

  let commentsHtml = '';
  if (detail.comments?.length) {
    commentsHtml = [
      '<div class="wb-comments">',
        '<div class="wb-detail-meta"><span class="wb-pill">comments: ' + detail.comments.length + '</span></div>',
        detail.comments.map((c) =>
          '<div class="wb-comment">' +
            '<div class="wb-comment-name">' + escapeHtml(c.name) + '</div>' +
            '<div class="wb-comment-text">' + escapeHtml(c.text) + '</div>' +
          '</div>'
        ).join(''),
      '</div>',
    ].join('');
  } else if (isRestricted) {
    commentsHtml = renderRestrictedMessage(detail.href);
  } else if (isLoginRequired) {
    commentsHtml = renderLoginRequiredMessage(detail.href);
  } else {
    commentsHtml = '<div class="wb-comments"><div class="muted">评论数据未加载。XHS 评论是 JS 动态渲染的，需要真实页面交互才能获取。' +
      renderOpenLink(detail.href) + '</div></div>';
  }

  body.innerHTML = [
    '<div class="wb-detail-title">' + escapeHtml(detail.title || 'untitled note') + '</div>',
    '<div class="wb-detail-meta">',
      '<span class="wb-pill">author: ' + escapeHtml(detail.author || 'unknown') + '</span>',
      '<span class="wb-pill">' + escapeHtml(shortHref(detail.href || '')) + '</span>',
      '<span class="wb-pill">source: ' + escapeHtml(detail.source || 'shell') + '</span>',
      renderOpenLink(detail.href),
    '</div>',
    media,
    '<div class="wb-detail-desc">' + escapeHtml(detail.desc || '') + '</div>',
    commentsHtml,
  ].join('');

  body.querySelectorAll<HTMLImageElement>('.wb-detail-media img').forEach((img) => {
    img.addEventListener('click', () => {
      window.open(img.src, '_blank');
    });
  });
}

function renderLoginRequiredMessage(href: string): string {
  return [
    '<div class="wb-comments" style="padding:12px;border:1px solid #ce9178;border-radius:6px;margin-top:10px;">',
      '<div class="orange">需要先登录小红书</div>',
      '<div class="muted" style="margin-top:6px;">当前页面弹出了登录框，详情和评论接口不会返回可用数据。登录后刷新页面，再点同一条笔记验证。</div>',
      '<div style="margin-top:10px;">',
        renderOpenLink(href),
      '</div>',
    '</div>',
  ].join('');
}

function renderRestrictedMessage(href: string): string {
  return [
    '<div class="wb-comments" style="padding:12px;border:1px solid #ce9178;border-radius:6px;margin-top:10px;">',
      '<div class="orange">XHS 限制了 iframe/fetch 访问此页面</div>',
      '<div class="muted" style="margin-top:6px;">评论和完整描述无法在壳层内加载，需要用真实浏览器窗口打开。</div>',
      '<div style="margin-top:10px;">',
        '<a href="' + escapeAttr(href) + '" target="_blank" ',
          'style="display:inline-block;padding:5px 12px;background:#0e639c;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;">',
          '在 XHS 中打开 ↗</a>',
      '</div>',
    '</div>',
  ].join('');
}

function renderOpenLink(href: string): string {
  if (!href) return '';
  const url = href.startsWith('http') ? href : 'https://www.xiaohongshu.com' + href;
  return ' <a href="' + escapeAttr(url) + '" target="_blank" class="blue" style="text-decoration:underline;cursor:pointer;">Open in XHS ↗</a>';
}

export function renderRightEmpty(): void {
  setText(IDS.rightTitle, 'DETAIL PANEL');
  setActiveTabStyle('detail');

  const body = document.getElementById(IDS.rightBody);
  if (!body) return;

  const cards = getCards();

  body.innerHTML = [
    '<div class="wb-console">',
      '<span class="green">[ready]</span> Shell renderer mounted\n',
      '<span class="blue">[cards]</span> ' + cards.length + ' native note cards indexed\n',
      '<span class="yellow">[usage]</span> click a row to load detail via native page + bridge\n',
      '<span class="muted">[note]</span> comments may not load due to XHS restrictions\n',
      '<span class="muted">[note]</span> drag splitters to resize panels',
    '</div>',
  ].join('');
}

function setActiveTabStyle(mode: string): void {
  document.querySelectorAll('#' + IDS.app + ' .wb-tab-small').forEach((tab) => {
    tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
  });
}
