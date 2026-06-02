// Render the master icon.svg to icons/icon{16,32,48,128}.png.
// Headless Chrome renders a crisp 256px base (transparent bg) but may not self-exit,
// so we run it detached, wait for the screenshot to appear, kill it, then downscale
// with macOS `sips`. Run from repo root: `npm run icons`.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = fileURLToPath(new URL('..', import.meta.url)); // repo root, trailing slash
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const svg = readFileSync(root + 'icon.svg', 'utf8').replace(/width="\d+" height="\d+"/, 'width="256" height="256"');
mkdirSync(root + 'icons', { recursive: true });
writeFileSync('/tmp/pe-icon.html', `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`);

const base = root + 'icons/_base.png';
rmSync(base, { force: true });
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=/tmp/pe-icon-profile',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--default-background-color=00000000',
  '--window-size=256,256', `--screenshot=${base}`, 'file:///tmp/pe-icon.html',
], { stdio: 'ignore', detached: true });

const ready = () => { try { return existsSync(base) && statSync(base).size > 0; } catch { return false; } };
const deadline = Date.now() + 20000;
while (!ready() && Date.now() < deadline) sleep(300);
sleep(200); // let the write flush
try { process.kill(-child.pid); } catch {}
try { child.kill('SIGKILL'); } catch {}
if (!ready()) { console.error('icon render failed — no screenshot produced'); process.exit(1); }

for (const n of [16, 32, 48, 128]) execSync(`sips -z ${n} ${n} "${base}" --out "${root}icons/icon${n}.png"`, { stdio: 'ignore' });
rmSync(base, { force: true });
rmSync('/tmp/pe-icon-profile', { recursive: true, force: true });
console.log('rendered icons: 16/32/48/128 from icon.svg');
