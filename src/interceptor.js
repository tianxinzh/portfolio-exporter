// Injected into the PAGE context so it can see the app's own fetch/XHR responses.
// Observe-only: it NEVER initiates a request. It taps response bodies as the page
// reads them (Response.prototype.json/text) and listens to XHR loads — so blocked
// cross-origin requests (e.g. the host site's ad pixels) are attributed to the
// page, not to this script, keeping the extension's error log clean.
(() => {
  const MATCH = [
    'api.robinhood.com/positions',
    'api.robinhood.com/instruments/',
    'options/aggregate_positions',
    'options/positions',
    'options/instruments',
    'nummus.robinhood.com/holdings',
    'api.robinhood.com/accounts/', // settled cash balance
    'marketdata/quotes',         // equity prices
    'marketdata/options',        // option mark prices
    'marketdata/forex/quotes',   // crypto prices
  ];
  const matches = (url) => typeof url === 'string' && MATCH.some((m) => url.includes(m));
  const forward = (url, text) => {
    let body;
    try { body = JSON.parse(text); } catch { return; }
    window.postMessage({ source: 'rh-export', url, body }, '*');
  };

  const origJson = Response.prototype.json;
  const origText = Response.prototype.text;
  const tap = (response) => {
    try {
      const url = response && response.url;
      if (matches(url)) origText.call(response.clone()).then((t) => forward(url, t)).catch(() => {});
    } catch {}
  };
  Response.prototype.json = function () { tap(this); return origJson.apply(this, arguments); };
  Response.prototype.text = function () { tap(this); return origText.apply(this, arguments); };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__rhUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      try { if (matches(this.__rhUrl)) forward(this.__rhUrl, this.responseText); } catch {}
    });
    return origSend.apply(this, args);
  };

  window.postMessage({ source: 'rh-export-ready' }, '*');
})();
