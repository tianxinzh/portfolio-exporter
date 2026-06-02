# Chrome Web Store listing — Portfolio Exporter

## Name
Portfolio Exporter

## Summary (≤132 chars)
Export your Robinhood holdings (stocks, options, crypto) with live prices to CSV, JSON, or YAML. 100% local.

## Category
Productivity

## Description
Portfolio Exporter turns your Robinhood holdings into a clean data file you control.

While you're signed in to robinhood.com, it reads the positions your browser has
already loaded — equities, options, and crypto, plus current prices — and exports
them to:

- CSV — a tracker schema, a Fidelity-style layout, or a raw all-fields dump
- JSON
- YAML — ready to drop into a positions tracker

Configure once on the Settings page: pick the format and columns, relabel the
account, include or exclude asset types, and drop dust positions. Your choices are
remembered.

Works with both the classic Robinhood site and the new Legend interface.

Privacy: 100% local. No servers, no analytics, no tracking. Your holdings never
leave your computer — the extension only converts what's on the page into a file
you download. Settings are stored with Chrome's storage API.

Not affiliated with or endorsed by Robinhood.

## Single purpose
Export the signed-in user's Robinhood holdings to a downloadable data file.

## Permission justifications
- Host access to `robinhood.com` — read the holdings data on the Robinhood page you're viewing.
- `downloads` — save the export file you request.
- `storage` — remember your export preferences between sessions.

## Data usage
- Collects or transmits user data? **No.** All processing is local; nothing is sent anywhere.
- No remote code.

## Screenshots to capture (1280×800 or 640×400)
1. Popup: per-type counts + format dropdown + Download button.
2. Settings page with the live preview.
3. A sample exported CSV opened in a spreadsheet.

## Assets
- Store icon: `icons/icon128.png`
- Privacy policy URL: host `privacy.html` somewhere public and paste the URL.
- Upload bundle: run `npm run zip` → `portfolio-exporter-v<version>.zip`.
