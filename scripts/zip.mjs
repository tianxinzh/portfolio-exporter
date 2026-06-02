// Build the Chrome Web Store upload bundle: only the files the extension ships
// (manifest + icons + src). Excludes tests, docs, scripts, and dotfiles.
// Run from the repo root: `npm run zip`.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const out = `portfolio-exporter-v${version}.zip`;
execSync(`rm -f "${out}" && zip -rq "${out}" manifest.json icons src`, { stdio: 'inherit' });
console.log('built', out);
