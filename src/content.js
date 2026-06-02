// Runs at document_start. Injects the page-context interceptor and accumulates
// captured payloads. Serves them to the popup / options page on request.
const captures = [];

(function inject() {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('src/interceptor.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
})();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const d = event.data;
  if (!d || d.source !== 'rh-export') return;
  captures.push({ url: d.url, body: d.body });
  console.debug('[portfolio-exporter] captured', d.url, 'total', captures.length);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'rh-get-captures') {
    sendResponse({ captures });
    return true;
  }
});
