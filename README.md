# Portfolio Exporter

A Chrome extension that exports your **Robinhood** holdings — equities, options,
and crypto, **with live prices** — to **CSV, JSON, or YAML**. 100% local: nothing
leaves your device.

Works on both the classic Robinhood site and the new **Legend** interface.

## Install

**From the Chrome Web Store:** _(link added after publishing)_

**Load unpacked (development):**
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
   - On Chrome 138+ the `--load-extension` command-line flag is gated — use the
     **Load unpacked** button in the UI, not the flag.

## Use
1. Sign in to **robinhood.com**; open your **Portfolio**, **Options**, and
   **Crypto** views so each feed loads. After installing the extension, **reload
   the tab** once.
2. Click the **Portfolio Exporter** toolbar icon → check the per-type counts →
   pick a format → **Download holdings**.
3. Fine-tune columns and filters on the **Settings** page (link in the popup).

## Output
- **Formats:** CSV · JSON · YAML (positions-tracker shape)
- **CSV column presets:** `tracker` (clean schema) · `fidelity` (Fidelity-style)
  · `raw` (all fields)
- **Filters:** account label · include/exclude equities/options/crypto · drop dust
- Includes `last_price`, `market_value`, and `unrealized_pnl` from the live
  marketdata snapshot at capture time.

## How it works
A page-context interceptor **observes** the JSON Robinhood's own app already
fetches (it never issues requests of its own), forwards it to the extension, which
normalizes it to canonical rows, joins live prices, and renders your chosen format.

## Privacy
100% local — no servers, no analytics, no trackers. Only your settings are stored
(via `chrome.storage`). See [PRIVACY.md](PRIVACY.md).

## Development
```
node --test      # run the unit tests (Node 18+, no dependencies)
npm run zip      # build the Web Store upload bundle
```
The pure core (`normalizer`, `enrich`, `formatters`, `settings.merge`) is
unit-tested; the browser glue (`interceptor`, `content`, `popup`, `options`) is
verified in Chrome.

## Disclaimer
Not affiliated with or endorsed by Robinhood. Read-only — it never places trades.
Use at your own discretion and in accordance with Robinhood's terms.
