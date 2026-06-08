export const VERSION = '5.0.3';
export const AUTHOR = 'imzusheng@163.com';
export const KEY = '__xhs_workbench_shell_v5__';

export const BRIDGE_MSG_KEY = '__xhs_wb5_bridge';
export const BRIDGE_MAX_DEPTH = 8;
export const BRIDGE_MAX_KEYS = 200;

export const API_PATH_PATTERNS = [
  /\/api\/sns\/web\/v1\/feed/,
  /\/api\/sns\/web\/v1\/homefeed/,
  /\/api\/sns\/web\/v1\/note/,
  /\/api\/sns\/web\/v2\/comment/,
  /\/api\/sns\/web\/v1\/search/,
  /\/api\/sns\/web\/v1\/explore/,
  /\/api\/sns\/web\/v1\/user\/otherinfo/,
  /\/api\/sns\/web\/v2\/note\/page/,
] as const;

export const IDS = {
  app: 'xhs-wb4-app',
  style: 'xhs-wb4-style',
  frame: 'wb4-detail-frame',
  list: 'wb4-list',
  tags: 'wb4-tags',
  resizerExplorer: 'wb4-resizer-explorer',
  resizerRight: 'wb4-resizer-right',
  toast: 'wb4-toast',
  searchInput: 'wb4-search-input',
  searchBtn: 'wb4-search-btn',
  clearBtn: 'wb4-clear-btn',
  toggleBtn: 'wb4-toggle-btn',
  imageBtn: 'wb4-image-btn',
  refreshBtn: 'wb4-refresh-btn',
  nativeBtn: 'wb4-native-btn',
  closeDetail: 'wb4-close-detail',
  rightTitle: 'wb4-right-title',
  rightBody: 'wb4-right-body',
  routeLabel: 'wb4-route',
  imageLabel: 'wb4-image-label',
  statusLeft: 'wb4-status-left',
  statusRight: 'wb4-status-right',
  listHead: 'wb4-list-head',
  listContainer: 'wb4-list',
} as const;

export const IMAGE_MODES = ['terminal', 'issue', 'blur', 'normal'] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

export const SEARCH_TIMEOUT_MS = 12000;
export const SEARCH_POLL_INTERVAL_MS = 600;
export const SCAN_DEBOUNCE_MS = 600;
export const NATIVE_PEEK_DURATION_MS = 5000;
export const TOAST_DURATION_MS = 1300;
export const INIT_SCAN_DELAY_MS = 700;
export const URL_WATCH_INTERVAL_MS = 800;
export const DETAIL_FRAME_TIMEOUT_MS = 7000;
export const DETAIL_EXTRACT_DELAY_MS = 900;
export const DETAIL_AFTER_LOAD_DELAY_MS = 1900;
export const COMMENT_SCROLL_POLL_MS = 600;
export const COMMENT_MAX_WAIT_MS = 5000;

export const NOISE_PATTERNS = [
  /^(赞|评论|收藏|分享|更多|登录|首页|发现|发布|通知|消息|直播|展开|收起|关注|已关注)$/,
  /^[0-9.]+万?$/,
  /^IP属地/,
];

export const DEFAULT_STATE = {
  enabled: true,
  imageMode: 'terminal' as ImageMode,
  nativeVisible: false,
  rightMode: 'detail',
  query: '',
  explorerWidth: 240,
  rightWidth: 520,
};
