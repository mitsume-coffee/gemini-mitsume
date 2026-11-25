/**
 * kintone カスタマイズ用（Phase 3：二層の記憶）
 */
(() => {
  'use strict';
  const IFRAME_URL = 'https://mitsume-coffee.github.io/gemini-mitsume/';
  const IFRAME_ORIGIN = 'https://mitsume-coffee.github.io';
  const HEIGHT = '480px';
  const CONTEXT_MAX = 3500;
  let iframeEl = null;
  let pendingContext = '';
  function formatValue(field) {
    const v = field.value;
    if (v === null || v === undefined || v === '') return '';
    if (Array.isArray(v)) {
      return v.map((item) => {
        if (item && typeof item === 'object') {
          if (item.name) return item.name;
          if (item.code) return item.name || item.code;
          return JSON.stringify(item);
        }
        return String(item);
      }).join(', ');
    }
    if (typeof v === 'object') {
      if (v.name) return v.name;
      if (v.code) return v.name || v.code;
      return JSON.stringify(v);
    }
    return String(v);
  }
  function recordToText(record) {
    const lines = [];
    Object.keys(record).forEach((code) => {
      if (code === '$id' || code === '$revision') return;
      const field = record[code];
      if (!field || field.type === 'SUBTABLE') {
        if (field && field.type === 'SUBTABLE' && Array.isArray(field.value) && field.value.length) {
          lines.push(code + ': （' + field.value.length + '行のテーブル）');
        }
        return;
      }
      const text = formatValue(field);
      if (text) lines.push(code + ': ' + text);
    });
    let out = lines.join('\n');
    if (out.length > CONTEXT_MAX) out = out.slice(0, CONTEXT_MAX) + '\n…（以下省略）';
    return out;
  }
  function sendContext() {
    if (iframeEl && iframeEl.contentWindow) {
      iframeEl.contentWindow.postMessage({ type: 'mitsume-context', context: pendingContext }, IFRAME_ORIGIN);
      try {
        const u = kintone.getLoginUser();
        if (u && u.code) {
          iframeEl.contentWindow.postMessage({ type: 'mitsume-user', userCode: u.code, userName: u.name || '' }, IFRAME_ORIGIN);
        }
      } catch (err) { }
    }
  }
  function mount(spaceElement) {
    if (!spaceElement) return;
    if (iframeEl && spaceElement.contains(iframeEl)) return;
    iframeEl = document.createElement('iframe');
    iframeEl.src = IFRAME_URL;
    iframeEl.setAttribute('data-mitsume', '1');
    iframeEl.style.width = '100%';
    iframeEl.style.height = HEIGHT;
    iframeEl.style.border = '1px solid #ddd';
    iframeEl.style.borderRadius = '8px';
    iframeEl.addEventListener('load', () => setTimeout(sendContext, 500));
    spaceElement.appendChild(iframeEl);
  }
  window.addEventListener('message', (e) => {
    if (e.origin === IFRAME_ORIGIN && e.data && e.data.type === 'mitsume-ready') sendContext();
  });
  kintone.events.on('app.record.index.show', (event) => {
    pendingContext = '';
    mount(kintone.app.getHeaderMenuSpaceElement());
    return event;
  });
  kintone.events.on('app.record.detail.show', (event) => {
    const appId = kintone.app.getId();
    const recordId = event.recordId || (event.record && event.record.$id && event.record.$id.value);
    const body = event.record ? recordToText(event.record) : '';
    pendingContext = '【開いているkintoneレコード】アプリID: ' + appId + ' / レコード番号: ' + recordId + '\n' + body;
    mount(kintone.app.record.getHeaderMenuSpaceElement());
    setTimeout(sendContext, 800);
    return event;
  });
})();
