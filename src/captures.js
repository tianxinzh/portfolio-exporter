// Find a Robinhood tab (by URL — not the active tab, since the Settings page is
// itself the active tab) and pull its accumulated captures. Returns [] if none.
// Querying by URL is covered by the robinhood.com host permission (no "tabs" perm).
export async function getCaptures() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: '*://*.robinhood.com/*' }); } catch {}
  for (const tab of tabs) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'rh-get-captures' });
      if (resp && Array.isArray(resp.captures) && resp.captures.length) return resp.captures;
    } catch { /* this tab has no content script yet — try the next */ }
  }
  return [];
}
