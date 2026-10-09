#!/usr/bin/env node
// Photographs the app's real screens for the landing page.
//
//   SMOKE_MODULES=/tmp/smoke node scripts/capture-app-screens.mjs [--out public/app]
//
// It exports a web build with EXPO_PUBLIC_APP_SCREENSHOTS=1, which enables the /capture route
// (src/app/capture.tsx) and keeps the mobile light palette on web. That route renders the real
// screens with labelled demo data. The build is served locally and each screen is captured at
// a 390x844 phone viewport. These are react-native-web renders of the app's screens, not
// captures from a physical device.
//
// Like scripts/smoke-web.mjs it needs Playwright, which is deliberately not a project
// dependency: install it elsewhere and point SMOKE_MODULES at that directory.
// SMOKE_CHROMIUM may name a Chromium executable to use instead of Playwright's own.
// Converting to WebP needs python3 with Pillow.

import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCREENS = ['draft', 'agreement', 'scopeguard', 'proposal'];
const VIEWPORT = { width: 390, height: 844 };

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(root, option('out', 'public/app'));
const dist = mkdtempSync(path.join(tmpdir(), 'owlset-capture-'));

function loadPlaywright() {
  for (const base of [process.env.SMOKE_MODULES, process.cwd()].filter(Boolean)) {
    try {
      return createRequire(path.resolve(base, 'package.json'))('playwright');
    } catch {
      // try the next location
    }
  }
  throw new Error('Playwright is not installed. Set SMOKE_MODULES to a directory where it is (see the top of this file).');
}

// Metro keeps its transform cache in $TMPDIR/metro-cache and does not key it on EXPO_PUBLIC_*
// values. A private TMPDIR keeps this build's palette and routes out of normal builds, and
// stops cached output from an earlier normal build being reused here.
const metroTmp = mkdtempSync(path.join(tmpdir(), 'owlset-metro-'));

{
  console.log(`Exporting the screenshot build to ${dist}`);
  const build = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dist], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TMPDIR: metroTmp, EXPO_PUBLIC_APP_SCREENSHOTS: '1', EXPO_PUBLIC_SAKLAW_FIXTURES: '1' },
  });
  if (build.status !== 0) throw new Error('expo export failed');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

// A single-page server: unknown paths fall back to index.html, like the deployed site.
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  let file = path.join(dist, pathname);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  response.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(path.join(tmpdir(), 'owlset-shots-'));
const { chromium } = loadPlaywright();
const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {});
let failed = false;
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  for (const screen of SCREENS) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/capture?screen=${screen}`, { waitUntil: 'load' });
    await page.waitForSelector('#root *', { timeout: 20000 });
    // Let fonts, icons and layout settle before the picture is taken.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const text = (await page.locator('body').innerText()).trim();
    if (text.length < 20) {
      console.error(`FAIL  ${screen}: nothing rendered${errors.length ? ` (${errors[0]})` : ''}`);
      failed = true;
    } else {
      const png = path.join(staging, `${screen}.png`);
      const file = path.join(outDir, `${screen}.webp`);
      await page.screenshot({ path: png, type: 'png' });
      const convert = spawnSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=88, method=6)', png, file], { encoding: 'utf8' });
      if (convert.status !== 0) throw new Error(`WebP conversion needs python3 with Pillow: ${convert.stderr.trim().split('\n').pop()}`);
      console.log(`ok    ${screen} -> ${path.relative(root, file)}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
  rmSync(staging, { recursive: true, force: true });
  rmSync(metroTmp, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
