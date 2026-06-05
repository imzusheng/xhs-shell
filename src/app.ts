import { IDS, VERSION, AUTHOR, KEY } from './constants';

export function addStyle(): void {
  if (document.getElementById(IDS.style)) return;

  const css = `
    :root[data-xhs-wb4="on"] {
      --wb-bg:#1e1e1e;
      --wb-bg2:#252526;
      --wb-bg3:#2d2d30;
      --wb-panel:#181818;
      --wb-border:#3c3c3c;
      --wb-text:#d4d4d4;
      --wb-muted:#858585;
      --wb-blue:#007acc;
      --wb-cyan:#9cdcfe;
      --wb-green:#6a9955;
      --wb-yellow:#dcdcaa;
      --wb-orange:#ce9178;
      --wb-red:#f44747;
      --wb-purple:#c586c0;
      --wb-font:Menlo,Monaco,Consolas,"SF Mono","Cascadia Code","Fira Code","Courier New",monospace;
    }

    :root[data-xhs-wb4="on"] body {
      background:#0f0f0f !important;
      overflow:hidden !important;
    }

    :root[data-xhs-wb4="on"][data-xhs-wb4-native-visible="off"] body > *:not(#xhs-wb4-app) {
      opacity:0 !important;
      visibility:hidden !important;
      pointer-events:none !important;
    }

    :root[data-xhs-wb4="on"][data-xhs-wb4-native-visible="on"] #xhs-wb4-app {
      opacity:.18 !important;
      pointer-events:none !important;
    }

    #xhs-wb4-app {
      position:fixed;
      z-index:2147483647;
      inset:0;
      display:none;
      background:#1e1e1e;
      color:#d4d4d4;
      font-family:Menlo,Monaco,Consolas,"SF Mono","Cascadia Code","Fira Code","Courier New",monospace;
      font-size:13px;
      line-height:1.45;
      --explorer-w:240px;
      --right-w:520px;
    }

    :root[data-xhs-wb4="on"] #xhs-wb4-app {
      display:block;
    }

    #xhs-wb4-app * {
      box-sizing:border-box;
      font-family:inherit;
    }

    #xhs-wb4-app button,
    #xhs-wb4-app input,
    #xhs-wb4-app textarea {
      font-family:inherit;
    }

    #xhs-wb4-app .wb-shell {
      height:100vh;
      display:grid;
      grid-template-columns:50px var(--explorer-w) minmax(360px,1fr) var(--right-w);
      grid-template-rows:38px minmax(0,1fr) 24px;
      background:#1e1e1e;
    }

    #xhs-wb4-app .wb-top {
      grid-column:1 / 5;
      grid-row:1;
      display:flex;
      align-items:center;
      height:38px;
      background:#181818;
      border-bottom:1px solid #2d2d2d;
      color:#ccc;
      user-select:none;
    }

    #xhs-wb4-app .wb-tab {
      height:38px;
      display:flex;
      align-items:center;
      gap:8px;
      padding:0 14px;
      background:#1f1f1f;
      border-right:1px solid #2d2d2d;
      color:#d4d4d4;
      white-space:nowrap;
    }

    #xhs-wb4-app .wb-tab:before {
      content:"TS";
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:18px;
      height:18px;
      background:#3178c6;
      color:#fff;
      font-size:9px;
      font-weight:700;
      border-radius:2px;
    }

    #xhs-wb4-app .wb-path {
      flex:1;
      min-width:0;
      display:flex;
      gap:8px;
      align-items:center;
      padding:0 12px;
      color:#858585;
      white-space:nowrap;
      overflow:hidden;
    }

    #xhs-wb4-app .wb-path b {
      color:#d4d4d4;
      font-weight:400;
    }

    #xhs-wb4-app .wb-top-actions {
      display:flex;
      align-items:center;
      gap:8px;
      padding-right:10px;
      color:#858585;
    }

    #xhs-wb4-app button {
      height:26px;
      padding:0 9px;
      background:#252526;
      color:#d4d4d4;
      border:1px solid #3c3c3c;
      border-radius:4px;
      cursor:pointer;
      font-size:12px;
    }

    #xhs-wb4-app button:hover {
      background:#2a2d2e;
      border-color:#007acc;
    }

    #xhs-wb4-app button.primary {
      background:#0e639c;
      border-color:#0e639c;
      color:#fff;
    }

    #xhs-wb4-app .wb-activity {
      grid-column:1;
      grid-row:2;
      background:#333;
      border-right:1px solid #252526;
      display:flex;
      flex-direction:column;
      align-items:center;
      color:#c5c5c5;
    }

    #xhs-wb4-app .wb-icon {
      width:50px;
      height:48px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:20px;
      opacity:.72;
      border-left:2px solid transparent;
    }

    #xhs-wb4-app .wb-icon.active {
      opacity:1;
      border-left-color:#fff;
    }

    #xhs-wb4-app .wb-icon.bottom {
      margin-top:auto;
    }

    #xhs-wb4-app .wb-explorer {
      grid-column:2;
      grid-row:2;
      background:#252526;
      border-right:1px solid #3c3c3c;
      overflow:hidden;
      user-select:none;
    }

    #xhs-wb4-app .wb-explorer-title {
      height:36px;
      display:flex;
      align-items:center;
      padding:0 14px;
      font-size:11px;
      letter-spacing:.08em;
      color:#bbb;
    }

    #xhs-wb4-app .wb-section {
      border-top:1px solid #303030;
    }

    #xhs-wb4-app .wb-section-title {
      height:28px;
      display:flex;
      align-items:center;
      padding:0 12px;
      font-size:11px;
      font-weight:700;
      color:#ccc;
    }

    #xhs-wb4-app .wb-file {
      height:25px;
      display:flex;
      align-items:center;
      gap:7px;
      padding:0 12px 0 22px;
      color:#ccc;
      font-size:12px;
      white-space:nowrap;
    }

    #xhs-wb4-app .wb-file.active {
      background:#37373d;
    }

    #xhs-wb4-app .wb-kind {
      font-size:10px;
      color:#3178c6;
      min-width:28px;
    }

    #xhs-wb4-app .wb-note {
      padding:10px 12px;
      color:#858585;
      font-size:11px;
      line-height:1.6;
      border-top:1px solid #303030;
    }

    #xhs-wb4-app .wb-main {
      grid-column:3;
      grid-row:2;
      min-width:0;
      display:flex;
      flex-direction:column;
      background:#1e1e1e;
      overflow:hidden;
    }

    #xhs-wb4-app .wb-search {
      padding:16px 18px 12px;
      border-bottom:1px solid #2d2d2d;
      background:#1e1e1e;
    }

    #xhs-wb4-app .wb-search-row {
      display:flex;
      align-items:center;
      gap:10px;
    }

    #xhs-wb4-app .wb-search input {
      flex:1;
      height:34px;
      background:#1b1b1b;
      border:1px solid #3c3c3c;
      color:#dcdcaa;
      border-radius:5px;
      outline:none;
      padding:0 12px;
      font-size:13px;
    }

    #xhs-wb4-app .wb-tags {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:12px;
      color:#858585;
    }

    #xhs-wb4-app .wb-tag {
      padding:3px 8px;
      border:1px solid #3c3c3c;
      border-radius:12px;
      background:#252526;
      font-size:12px;
      cursor:pointer;
    }

    #xhs-wb4-app .wb-tag:hover {
      border-color:#007acc;
      color:#9cdcfe;
    }

    #xhs-wb4-app .wb-list-head {
      height:34px;
      display:grid;
      grid-template-columns:80px minmax(0,1fr) 110px 90px;
      align-items:center;
      gap:12px;
      padding:0 18px;
      background:#181818;
      border-bottom:1px solid #2d2d2d;
      color:#858585;
      font-size:12px;
    }

    #xhs-wb4-app .wb-list {
      flex:1;
      min-height:0;
      overflow:auto;
      padding:10px 12px 18px;
    }

    #xhs-wb4-app .wb-card {
      display:grid;
      grid-template-columns:80px minmax(0,1fr) 110px 90px;
      gap:12px;
      align-items:center;
      min-height:86px;
      padding:8px 8px 8px 10px;
      margin-bottom:8px;
      background:#202020;
      border:1px solid #333;
      border-left:3px solid #007acc;
      border-radius:6px;
      cursor:pointer;
    }

    #xhs-wb4-app .wb-card:hover {
      background:#252526;
      border-color:#4a4a4a;
      border-left-color:#9cdcfe;
    }

    #xhs-wb4-app .wb-card.selected {
      background:#263238;
      border-left-color:#dcdcaa;
    }

    #xhs-wb4-app .wb-thumb {
      width:64px;
      height:64px;
      border:1px solid #3c3c3c;
      border-radius:5px;
      background:#111;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#858585;
      font-size:11px;
    }

    #xhs-wb4-app .wb-thumb img {
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
      filter:none;
      opacity:1;
    }

    #xhs-wb4-app .wb-card-title {
      color:#dcdcaa;
      font-size:13px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    #xhs-wb4-app .wb-card-desc {
      color:#d4d4d4;
      font-size:12px;
      margin-top:5px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    #xhs-wb4-app .wb-card-code {
      color:#9cdcfe;
      font-size:12px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    #xhs-wb4-app .wb-card-author {
      color:#6a9955;
      font-size:12px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    #xhs-wb4-app .wb-card-status {
      color:#6a9955;
      font-size:12px;
    }

    #xhs-wb4-app .wb-card-action {
      color:#858585;
      font-size:12px;
      text-align:right;
    }

    #xhs-wb4-app .wb-empty {
      padding:30px;
      color:#858585;
      text-align:center;
      font-size:13px;
    }

    #xhs-wb4-app .wb-right {
      grid-column:4;
      grid-row:2;
      background:#1e1e1e;
      border-left:1px solid #3c3c3c;
      display:flex;
      flex-direction:column;
      min-width:0;
      overflow:hidden;
    }

    #xhs-wb4-app .wb-right-head {
      height:36px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 12px;
      background:#252526;
      border-bottom:1px solid #3c3c3c;
      color:#ccc;
    }

    #xhs-wb4-app .wb-right-title {
      font-size:12px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    #xhs-wb4-app .wb-tabs {
      height:30px;
      display:flex;
      background:#252526;
      border-bottom:1px solid #3c3c3c;
    }

    #xhs-wb4-app .wb-tab-small {
      height:30px;
      display:flex;
      align-items:center;
      padding:0 10px;
      border-right:1px solid #303030;
      font-size:11px;
      color:#858585;
      cursor:pointer;
    }

    #xhs-wb4-app .wb-tab-small.active {
      color:#fff;
      background:#1e1e1e;
    }

    #xhs-wb4-app .wb-right-body {
      flex:1;
      min-height:0;
      overflow:auto;
      padding:12px;
    }

    #xhs-wb4-app .wb-detail-title {
      color:#dcdcaa;
      font-size:14px;
      line-height:1.5;
      margin-bottom:8px;
    }

    #xhs-wb4-app .wb-detail-meta {
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      color:#858585;
      font-size:12px;
      margin-bottom:10px;
    }

    #xhs-wb4-app .wb-pill {
      padding:2px 7px;
      border:1px solid #3c3c3c;
      border-radius:10px;
      background:#252526;
    }

    #xhs-wb4-app .wb-detail-desc {
      color:#d4d4d4;
      font-size:13px;
      line-height:1.65;
      white-space:pre-wrap;
      margin-bottom:12px;
    }

    #xhs-wb4-app .wb-detail-media {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
      margin:10px 0 12px;
    }

    #xhs-wb4-app .wb-detail-media img {
      width:100%;
      aspect-ratio:1/1;
      object-fit:cover;
      border:1px solid #3c3c3c;
      border-radius:5px;
      background:#111;
      cursor:pointer;
      transition:filter .15s ease, opacity .15s ease, transform .15s ease, box-shadow .15s ease;
    }

    #xhs-wb4-app[data-image="issue"] .wb-detail-media img {
      filter:grayscale(1) brightness(.48) contrast(.75);
      opacity:.64;
    }

    #xhs-wb4-app[data-image="blur"] .wb-detail-media img {
      filter:grayscale(1) blur(6px) brightness(.42) contrast(.7);
      opacity:.58;
    }

    #xhs-wb4-app[data-image="terminal"] .wb-detail-media img {
      filter:grayscale(1) brightness(.24) contrast(.55);
      opacity:.32;
    }

    #xhs-wb4-app[data-image="normal"] .wb-detail-media img {
      filter:grayscale(.12) brightness(.9);
      opacity:1;
    }

    #xhs-wb4-app .wb-detail-media img:hover,
    #xhs-wb4-app.peek .wb-detail-media img {
      filter:none !important;
      opacity:1 !important;
      transform:scale(1.04);
      z-index:2;
      box-shadow:0 0 0 1px #007acc, 0 8px 24px rgba(0,0,0,.42) !important;
    }

    #xhs-wb4-app .wb-comments {
      border-top:1px solid #333;
      margin-top:10px;
      padding-top:10px;
    }

    #xhs-wb4-app .wb-comment {
      padding:8px 0;
      border-bottom:1px solid #2a2a2a;
    }

    #xhs-wb4-app .wb-comment-name {
      color:#6a9955;
      font-size:12px;
      margin-bottom:4px;
    }

    #xhs-wb4-app .wb-comment-text {
      color:#d4d4d4;
      font-size:12px;
      line-height:1.55;
      white-space:pre-wrap;
    }

    #xhs-wb4-app .wb-console {
      font-size:12px;
      line-height:1.65;
      white-space:pre-wrap;
      color:#d4d4d4;
    }

    #xhs-wb4-app .green { color:#6a9955; }
    #xhs-wb4-app .yellow { color:#dcdcaa; }
    #xhs-wb4-app .blue { color:#9cdcfe; }
    #xhs-wb4-app .orange { color:#ce9178; }
    #xhs-wb4-app .muted { color:#858585; }

    #xhs-wb4-app .wb-loading {
      display:flex;
      gap:10px;
      align-items:flex-start;
      padding:12px;
      border:1px solid #333;
      border-radius:6px;
      background:#202020;
      margin-bottom:12px;
    }

    #xhs-wb4-app .wb-spinner {
      width:16px;
      height:16px;
      border:2px solid #3c3c3c;
      border-top-color:#007acc;
      border-radius:50%;
      animation:wb4Spin .8s linear infinite;
      margin-top:2px;
      flex:0 0 auto;
    }

    #xhs-wb4-app .wb-skeleton {
      height:10px;
      border-radius:4px;
      background:linear-gradient(90deg,#2a2a2a,#3a3a3a,#2a2a2a);
      background-size:200% 100%;
      animation:wb4Skeleton 1.2s ease-in-out infinite;
      margin:8px 0;
    }

    @keyframes wb4Spin {
      to { transform:rotate(360deg); }
    }

    @keyframes wb4Skeleton {
      0% { background-position:200% 0; }
      100% { background-position:-200% 0; }
    }

    #xhs-wb4-app .wb-status {
      grid-column:1 / 5;
      grid-row:3;
      height:24px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 10px;
      background:#007acc;
      color:#fff;
      font-size:12px;
      user-select:none;
    }

    #xhs-wb4-app .wb-toast {
      position:absolute;
      left:50%;
      top:54px;
      transform:translateX(-50%);
      display:none;
      padding:8px 12px;
      background:#252526;
      border:1px solid #007acc;
      border-radius:5px;
      color:#d4d4d4;
      font-size:12px;
      pointer-events:none;
    }

    #xhs-wb4-app .wb-toast.show {
      display:block;
    }

    #xhs-wb4-app .wb-resizer {
      position:absolute;
      top:38px;
      bottom:24px;
      width:8px;
      z-index:10;
      cursor:col-resize;
      background:transparent;
    }

    #xhs-wb4-app .wb-resizer:hover,
    #xhs-wb4-app.resizing .wb-resizer.active {
      background:rgba(0,122,204,.28);
    }

    #xhs-wb4-app .wb-resizer-explorer {
      left:calc(50px + var(--explorer-w) - 4px);
    }

    #xhs-wb4-app .wb-resizer-right {
      right:calc(var(--right-w) - 4px);
    }

    #wb4-detail-frame {
      position:absolute;
      left:-9999px;
      top:0;
      width:800px;
      height:600px;
      visibility:hidden;
      pointer-events:none;
      border:0;
    }

    #xhs-wb4-app ::-webkit-scrollbar { width:8px; height:8px; }
    #xhs-wb4-app ::-webkit-scrollbar-track { background:#1e1e1e; }
    #xhs-wb4-app ::-webkit-scrollbar-thumb { background:#3c3c3c; border-radius:0; }

    @media(max-width:1280px) {
      #xhs-wb4-app .wb-shell {
        grid-template-columns:50px 0 minmax(320px,1fr) minmax(360px,var(--right-w));
      }

      #xhs-wb4-app .wb-explorer,
      #xhs-wb4-app .wb-resizer-explorer {
        display:none;
      }
    }
  `;

  const style = document.createElement('style');
  style.id = IDS.style;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

export function createApp(): void {
  if (document.getElementById(IDS.app)) return;

  const app = document.createElement('div');
  app.id = IDS.app;
  app.setAttribute('data-image', 'terminal');

  app.innerHTML = [
    '<div class="wb-shell">',
      '<div class="wb-top">',
        '<div class="wb-tab">feed.service.ts</div>',
        '<div class="wb-path">',
          '<span>src</span>',
          '<span>&gt;</span>',
          '<span>modules</span>',
          '<span>&gt;</span>',
          '<span>xhs-workbench</span>',
          '<span>&gt;</span>',
          '<b id="wb4-route">explore()</b>',
        '</div>',
        '<div class="wb-top-actions">',
          '<span id="wb4-image-label">image: terminal</span>',
          '<button id="wb4-image-btn" type="button">Image</button>',
          '<button id="wb4-refresh-btn" type="button">Refresh</button>',
          '<button id="wb4-native-btn" type="button">Native</button>',
          '<button id="wb4-toggle-btn" type="button">Hide</button>',
          '<span>' + AUTHOR + '</span>',
        '</div>',
      '</div>',

      '<div class="wb-activity">',
        '<div class="wb-icon active">▣</div>',
        '<div class="wb-icon">⌕</div>',
        '<div class="wb-icon">⑂</div>',
        '<div class="wb-icon">▷</div>',
        '<div class="wb-icon">▦</div>',
        '<div class="wb-icon bottom">⚙</div>',
      '</div>',

      '<div class="wb-explorer">',
        '<div class="wb-explorer-title">EXPLORER</div>',
        '<div class="wb-section">',
          '<div class="wb-section-title">▾ XHS_WORKSPACE</div>',
          '<div class="wb-file active"><span class="wb-kind">TS</span><span>feed.service.ts</span></div>',
          '<div class="wb-file"><span class="wb-kind">TSX</span><span>note-detail-panel.tsx</span></div>',
          '<div class="wb-file"><span class="wb-kind">TS</span><span>native-bridge.ts</span></div>',
          '<div class="wb-file"><span class="wb-kind">CSS</span><span>workbench-shell.css</span></div>',
          '<div class="wb-file"><span class="wb-kind">JSON</span><span>search.params.json</span></div>',
        '</div>',
        '<div class="wb-section">',
          '<div class="wb-section-title">▾ OUTLINE</div>',
          '<div class="wb-file"><span class="wb-kind">fn</span><span>scanNativeCards()</span></div>',
          '<div class="wb-file"><span class="wb-kind">fn</span><span>loadDetailFrame()</span></div>',
          '<div class="wb-file"><span class="wb-kind">fn</span><span>dedupeNotes()</span></div>',
          '<div class="wb-file"><span class="wb-kind">fn</span><span>resizePanels()</span></div>',
        '</div>',
        '<div class="wb-note">Ctrl+Shift+X toggle<br>Ctrl+Shift+I image<br>Ctrl+Shift+N native peek<br>Alt hold: detail image peek<br>Drag splitters to resize</div>',
      '</div>',

      '<div class="wb-main">',
        '<div class="wb-search">',
          '<div class="wb-search-row">',
            '<input id="wb4-search-input" type="text" placeholder="Search files, notes, symbols, components..." />',
            '<button id="wb4-search-btn" class="primary" type="button">Search</button>',
            '<button id="wb4-clear-btn" type="button">Clear</button>',
          '</div>',
          '<div class="wb-tags" id="wb4-tags"></div>',
        '</div>',
        '<div class="wb-list-head">',
          '<span>Preview</span>',
          '<span>Request / Note</span>',
          '<span>Author</span>',
          '<span>Status</span>',
        '</div>',
        '<div class="wb-list" id="wb4-list"></div>',
      '</div>',

      '<div class="wb-right">',
        '<div class="wb-right-head">',
          '<div class="wb-right-title" id="wb4-right-title">DETAIL PANEL</div>',
          '<button id="wb4-close-detail" type="button">Clear</button>',
        '</div>',
        '<div class="wb-tabs">',
          '<div class="wb-tab-small active" data-mode="detail">Detail</div>',
          '<div class="wb-tab-small" data-mode="console">Console</div>',
          '<div class="wb-tab-small" data-mode="bridge">Bridge</div>',
        '</div>',
        '<div class="wb-right-body" id="wb4-right-body"></div>',
      '</div>',

      '<div class="wb-status">',
        '<span id="wb4-status-left">main ● TypeScript ● UTF-8 ● Spaces: 2</span>',
        '<span id="wb4-status-right">cards:0</span>',
      '</div>',
    '</div>',

    '<div class="wb-resizer wb-resizer-explorer" id="wb4-resizer-explorer"></div>',
    '<div class="wb-resizer wb-resizer-right" id="wb4-resizer-right"></div>',
    '<div class="wb-toast" id="wb4-toast"></div>',
    '<iframe id="wb4-detail-frame"></iframe>',
  ].join('');

  document.body.appendChild(app);
}
