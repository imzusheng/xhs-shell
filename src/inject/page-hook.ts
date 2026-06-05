export const BRIDGE_MSG_KEY = '__xhs_wb5_bridge';

export function getPageHookCode(): string {
  const KEY = BRIDGE_MSG_KEY;

  const code = `
(function() {
  if (window.__xhs_wb5_hook_installed) return;
  window.__xhs_wb5_hook_installed = true;

  var KEY = '${KEY}';
  var MAX_DEPTH = 5;
  var MAX_ARRAY_LEN = 50;
  var MAX_OBJ_KEYS = 100;
  var SENSITIVE = /cookie|token|sign|authorization|secret|password|key/i;

  var API_PATTERNS = [
    /\\/api\\/sns\\/web\\//i,
    /\\/api\\/sns\\/v\\d\\//i,
    /\\/fe_api\\//i
  ];

  // 只抓真正有内容的接口，过滤掉配置/统计类
  var SKIP_PATTERNS = [
    /system\\/config/i,
    /global\\/config/i,
    /unread_count/i,
    /user\\/me/i,
    /\\/zones/i,
    /\\/collect/i,
    /trending\\/query/i,
    /history\\/sync/i,
    /nps/i
  ];

  function sanitize(obj, depth) {
    if (depth > MAX_DEPTH) return '[MAX_DEPTH]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') {
      if (typeof obj === 'string' && obj.length > 5000) return obj.slice(0, 5000) + '...[TRUNC]';
      return obj;
    }
    if (Array.isArray(obj)) {
      var end = Math.min(obj.length, MAX_ARRAY_LEN);
      var arr = [];
      for (var i = 0; i < end; i++) arr.push(sanitize(obj[i], depth + 1));
      return arr;
    }
    var out = {};
    var keys = Object.keys(obj).slice(0, MAX_OBJ_KEYS);
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      out[k] = SENSITIVE.test(k) ? '[REDACTED]' : sanitize(obj[k], depth + 1);
    }
    return out;
  }

  function shouldCapture(url) {
    if (!url) return false;
    var matched = false;
    for (var i = 0; i < API_PATTERNS.length; i++) {
      if (API_PATTERNS[i].test(url)) { matched = true; break; }
    }
    if (!matched) return false;
    for (var k = 0; k < SKIP_PATTERNS.length; k++) {
      if (SKIP_PATTERNS[k].test(url)) return false;
    }
    return true;
  }

  function parseRequestBody(body) {
    if (!body) return null;
    if (typeof body === 'string') {
      if (body.length > 5000) return body.slice(0, 5000) + '...[TRUNC]';
      try { return JSON.parse(body); } catch(e) { return body; }
    }
    if (body instanceof URLSearchParams) {
      var out = {};
      body.forEach(function(value, key) { out[key] = value; });
      return out;
    }
    if (body instanceof FormData) {
      var form = {};
      body.forEach(function(value, key) {
        form[key] = typeof value === 'string' ? value : '[FILE]';
      });
      return form;
    }
    return '[UNSUPPORTED_BODY]';
  }

  function postResponse(url, method, status, body, via, requestBody) {
    try {
      window.postMessage({
        __xhs_wb5_bridge: true,
        type: 'api-response',
        url: String(url),
        method: String(method),
        status: Number(status),
        body: sanitize(body, 0),
        requestBody: sanitize(requestBody, 0),
        via: via || 'unknown',
        ts: Date.now()
      }, '*');
    } catch(e) {}
  }

  // ─── hook fetch ───
  var origFetch = window.fetch;
  var fetchCount = 0;
  window.fetch = function(input, init) {
    var url = '';
    var method = 'GET';
    if (typeof input === 'string') {
      url = input;
    } else if (input && input.url) {
      url = String(input.url);
    } else if (input && input.href) {
      url = String(input.href);
    } else if (input) {
      url = String(input);
    }
    if (init && init.method) method = String(init.method);
    var requestBody = init && init.body ? parseRequestBody(init.body) : null;

    if (url && url.indexOf('chrome-extension:') === -1) {
      var short = url.length > 100 ? url.slice(0, 100) + '...' : url;
      if (fetchCount < 5) {
        fetchCount++;
        console.log('[WB5 fetch#' + fetchCount + ']', method, short);
      }
      window.postMessage({
        __xhs_wb5_bridge: true,
        type: 'api-request',
        url: short,
        method: method,
        via: 'fetch-req'
      }, '*');
    }

    return origFetch.apply(this, arguments).then(function(resp) {
      if (shouldCapture(url)) {
        var clone = resp.clone();
        clone.text().then(function(text) {
          try {
            postResponse(url, method, resp.status, JSON.parse(text), 'fetch', requestBody);
          } catch(e) {}
        }).catch(function(){});
      }
      return resp;
    });
  };

  // ─── hook XHR (prototype) ───
  var XHRProto = XMLHttpRequest.prototype;
  var origXHROpen = XHRProto.open;
  var origXHRSend = XHRProto.send;
  var xhrCount = 0;

  XHRProto.open = function(method, url) {
    this.__xhs_url = String(url || '');
    this.__xhs_method = String(method || 'GET');

    if (url && url.indexOf('chrome-extension:') === -1) {
      var short = (url + '').length > 100 ? (url + '').slice(0, 100) + '...' : url;
      if (xhrCount < 5) {
        xhrCount++;
        console.log('[WB5 xhr#' + xhrCount + ']', String(method || 'GET'), short);
      }
      window.postMessage({
        __xhs_wb5_bridge: true,
        type: 'api-request',
        url: short,
        method: String(method || 'GET'),
        via: 'xhr-req'
      }, '*');
    }

    return origXHROpen.apply(this, arguments);
  };

  XHRProto.send = function(body) {
    var self = this;
    var url = self.__xhs_url || '';
    var method = self.__xhs_method || 'GET';
    var requestBody = parseRequestBody(body);

    self.addEventListener('load', function() {
      if (shouldCapture(url)) {
        try {
          postResponse(url, method, self.status, JSON.parse(self.responseText), 'xhr', requestBody);
        } catch(e) {}
      }
    });

    return origXHRSend.apply(self, arguments);
  };

  console.log('[XHS WB5 Hook] installed at document-start');

  // immediate test: verify postMessage bridge works
  try {
    window.postMessage({ __xhs_wb5_bridge: true, type: 'api-response', url: 'TEST_PING', method: 'TEST', status: 0, body: { _test: true }, ts: Date.now() }, '*');
  } catch(e) { console.warn('[XHS WB5 Hook] test postMessage failed', e); }
})();
`;

  return code;
}
