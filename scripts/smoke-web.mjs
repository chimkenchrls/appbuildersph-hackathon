#!/usr/bin/env node
// Smoke checks for the deployed OwlSet web landing page. Used by the CD workflow after
// publishing, and runnable by hand against any URL:
//
//   node scripts/smoke-web.mjs --url https://example.vercel.app [--expect-index path/to/index.html]
//
// It needs Playwright, which is deliberately not a project dependency. Install it somewhere
// else and point SMOKE_MODULES at that directory (see docs/DEPLOYMENT.md):
//
//   npm install --prefix /tmp/smoke playwright@1.64.0 && npx --prefix /tmp/smoke playwright install chromium
//   SMOKE_MODULES=/tmp/smoke node scripts/smoke-web.mjs --url ...
//
// Options, all optional except --url:
//   --expect-index FILE   the built index.html; the live page must be byte-identical to it,
//                         which proves the domain serves this build and not an older one
//   --attempts N          how many times to poll for readiness (default 12)
//   --delay MS            wait between polls (default 5000)
//   --summary FILE        append a Markdown table of results (the CI job summary)
// SMOKE_CHROMIUM may name a Chromium executable to use instead of Playwright's own.

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const TITLE = 'OwlSet';
const ROUTE = '/project/demo-website';

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = (option('url', '') || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Usage: smoke-web.mjs --url https://host [--expect-index FILE] [--attempts N] [--delay MS] [--summary FILE]');
  process.exit(2);
}
const expectIndex = option('expect-index');
const attempts = Number(option('attempts', '12'));
const delay = Number(option('delay', '5000'));
const summaryFile = option('summary');

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail: detail ?? '' });
    console.log(`ok    ${name}${detail ? `: ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, detail: String(error.message ?? error).split('\n')[0] });
    console.log(`FAIL  ${name}: ${error.message ?? error}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(pathname) {
  const response = await fetch(base + pathname, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, type: response.headers.get('content-type') ?? '', body };
}

// The home page must be the landing page's HTML. A JSON 404 from some other project fails here.
async function homePage() {
  const { status, type, body } = await get('/');
  expect(status === 200, `GET / returned HTTP ${status} (${type})`);
  expect(type.startsWith('text/html'), `GET / returned ${type}, not HTML`);
  const html = body.toString('utf8');
  expect(/<title>\s*OwlSet/.test(html), `GET / has no "${TITLE}" document title`);
  expect(html.includes('id="root"') && /<script[^>]+src="\/_expo\//.test(html), 'GET / is not the exported app shell');
  if (expectIndex) {
    const built = readFileSync(expectIndex);
    expect(sha256(built) === sha256(body), 'GET / differs from the index.html built for this commit (an older deployment is still being served)');
  }
  return `HTTP 200, ${type}${expectIndex ? ', matches this build' : ''}`;
}

// Publication can take a moment to reach the domain, so the first check is retried a bounded number of times.
async function waitUntilReady() {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return `${await homePage()} (attempt ${attempt} of ${attempts})`;
    } catch (error) {
      last = error;
      console.log(`      not ready (attempt ${attempt} of ${attempts}): ${error.message}`);
      if (attempt < attempts) await sleep(delay);
    }
  }
  throw last;
}

// Every path falls back to the HTML shell, so an asset only counts if its type and its first bytes are right.
const ASSETS = [
  { path: '/mascots/kwagi-directions.webp', type: 'image/webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { path: '/mascots/kwagi-reactions.webp', type: 'image/webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { path: '/fonts/Geist-Variable.woff2', type: 'font/woff2', magic: (b) => b.subarray(0, 4).toString('latin1') === 'wOF2' },
  { path: '/fonts/GeistMono-Variable.woff2', type: 'font/woff2', magic: (b) => b.subarray(0, 4).toString('latin1') === 'wOF2' },
  { path: '/favicon.png', type: 'image/png', magic: (b) => b.subarray(1, 4).toString('latin1') === 'PNG' },
];

async function asset({ path: pathname, type, magic }) {
  const response = await get(pathname);
  expect(response.status === 200, `HTTP ${response.status}`);
  expect(response.type.startsWith(type), `content type is ${response.type || 'missing'}, expected ${type}`);
  expect(magic(response.body), 'the body is not a file of that type');
  return `${response.type}, ${response.body.length} bytes`;
}

function loadPlaywright() {
  const roots = [process.env.SMOKE_MODULES, process.cwd()].filter(Boolean);
  for (const root of roots) {
    try {
      return createRequire(path.resolve(root, 'package.json'))('playwright');
    } catch {
      // try the next location
    }
  }
  throw new Error('Playwright is not installed. Set SMOKE_MODULES to a directory where it is (see the top of this file).');
}

async function browserChecks() {
  let chromium;
  try {
    ({ chromium } = loadPlaywright());
  } catch (error) {
    await check('browser available', () => {
      throw error;
    });
    return;
  }
  const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {});
  try {
    // ---- Desktop: the page renders after JavaScript loads, and its controls respond.
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await desktop.newPage();
    const pageErrors = [];
    const sprites = new Map();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/mascots/')) sprites.set(url.pathname, response.status());
    });

    await check('landing page renders in a browser', async () => {
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.locator('h1.lp-h1').waitFor({ state: 'visible', timeout: 20000 });
      const title = await page.title();
      expect(title.includes(TITLE), `document title is "${title}"`);
      const heading = (await page.locator('h1.lp-h1').innerText()).replace(/\s+/g, ' ').trim();
      expect(heading.length > 10, 'the headline is empty');
      const sections = await page.locator('main section').count();
      expect(sections >= 5, `only ${sections} sections rendered`);
      return `title "${title}", ${sections} sections`;
    });

    await check('demo controls respond', async () => {
      const options = page.locator('.lp-demo [role="radio"]');
      const count = await options.count();
      expect(count >= 2, `found ${count} demo options`);
      const result = page.locator('.lp-result');
      const before = await result.innerText();
      const target = (await options.nth(0).getAttribute('aria-checked')) === 'true' ? 1 : 0;
      await options.nth(target).scrollIntoViewIfNeeded();
      await options.nth(target).click();
      await page.waitForFunction((index) => document.querySelectorAll('.lp-demo [role="radio"]')[index].getAttribute('aria-checked') === 'true', target);
      await page.waitForFunction((text) => document.querySelector('.lp-result').innerText !== text, before);
      const cited = await page.locator('.lp-clause[data-cited="true"]').count();
      expect(cited >= 1, 'no clause is marked as cited');
      return `${count} options, result and cited clauses update`;
    });

    await check('hero Kwagi reacts to a click', async () => {
      const kwagi = page.locator('.lp-kwagi button');
      await kwagi.scrollIntoViewIfNeeded();
      const reactionOpacity = () => kwagi.evaluate((node) => getComputedStyle(node.querySelectorAll('span > span')[1]).opacity);
      expect((await reactionOpacity()) === '0', 'a reaction is showing before any click');
      await kwagi.click();
      await page.waitForFunction(() => getComputedStyle(document.querySelectorAll('.lp-kwagi button span > span')[1]).opacity === '1', null, { timeout: 5000 });
      expect(sprites.get('/mascots/kwagi-directions.webp') === 200, 'the directions sprite sheet did not load in the page');
      expect(sprites.get('/mascots/kwagi-reactions.webp') === 200, 'the reactions sprite sheet did not load in the page');
      return 'reaction frame shown, both sprite sheets loaded';
    });

    await check('closing Kwagi opens his speech bubble', async () => {
      const says = page.locator('.lp-says');
      await says.scrollIntoViewIfNeeded();
      expect((await says.getAttribute('data-open')) === null, 'the bubble is open before any click');
      await page.locator('.lp-says-kwagi').click();
      await page.waitForFunction(() => document.querySelector('.lp-says').hasAttribute('data-open'), null, { timeout: 5000 });
      await page.locator('.lp-speech').waitFor({ state: 'visible', timeout: 5000 });
      const line = await page.locator('.lp-says [aria-live]').innerText();
      expect(line.trim().length > 10, 'the bubble has no text');
      return 'bubble opens with his first line';
    });

    await check('no script errors on the page', () => {
      expect(pageErrors.length === 0, pageErrors.join(' | '));
    });

    await check(`direct visit to ${ROUTE} lands on the landing page`, async () => {
      const response = await page.goto(base + ROUTE, { waitUntil: 'load' });
      expect(response && response.status() === 200, `HTTP ${response ? response.status() : 'none'}`);
      await page.waitForFunction(() => window.location.pathname === '/', null, { timeout: 20000 });
      await page.locator('h1.lp-h1').waitFor({ state: 'visible', timeout: 20000 });
      return 'HTTP 200, then redirected to /';
    });
    await desktop.close();

    // ---- Small phone: the menu works and nothing scrolls sideways.
    const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    const small = await phone.newPage();
    await small.goto(`${base}/`, { waitUntil: 'load' });
    await small.locator('h1.lp-h1').waitFor({ state: 'visible', timeout: 20000 });

    await check('mobile menu opens and closes (360px wide)', async () => {
      const button = small.locator('.lp-menu-btn');
      await button.waitFor({ state: 'visible' });
      expect((await button.getAttribute('aria-expanded')) === 'false', 'the menu starts open');
      await button.tap();
      const menu = small.locator('#lp-menu');
      await menu.waitFor({ state: 'visible', timeout: 5000 });
      const links = await menu.locator('a').count();
      expect(links >= 4, `the menu has ${links} links`);
      expect((await button.getAttribute('aria-expanded')) === 'true', 'aria-expanded did not change');
      await menu.locator('a').first().tap();
      await menu.waitFor({ state: 'hidden', timeout: 5000 });
      return `${links} links, closes after choosing one`;
    });

    await check('no horizontal overflow (360px wide)', async () => {
      const sizes = await small.evaluate(async () => {
        const scroller = document.querySelector('.lp');
        // Visit the whole page so late sections are laid out and revealed.
        for (let y = 0; y <= scroller.scrollHeight; y += 600) {
          scroller.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return {
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          client: scroller.clientWidth,
          scroll: scroller.scrollWidth,
          canScroll: (scroller.scrollTo(9999, scroller.scrollTop), scroller.scrollLeft),
        };
      });
      expect(sizes.document <= sizes.viewport, `the document is ${sizes.document}px wide in a ${sizes.viewport}px viewport`);
      expect(sizes.canScroll === 0, `the page scrolls sideways by ${sizes.canScroll}px`);
      return `document ${sizes.document}px in a ${sizes.viewport}px viewport, no sideways scroll`;
    });
    await phone.close();
  } finally {
    await browser.close();
  }
}

console.log(`Smoke checks for ${base}`);
await check('home page is the OwlSet landing page', waitUntilReady);
const ready = results[0].ok;
if (ready) {
  for (const item of ASSETS) await check(`asset ${item.path}`, () => asset(item));
  await check(`GET ${ROUTE}`, async () => {
    const { status, type } = await get(ROUTE);
    expect(status === 200 && type.startsWith('text/html'), `HTTP ${status} ${type}`);
    return `HTTP ${status}, ${type}`;
  });
  await browserChecks();
} else {
  console.log('The home page never became ready, so the remaining checks were skipped.');
}

const failed = results.filter((result) => !result.ok);
if (summaryFile) {
  const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const rows = results.map((result) => `| ${result.ok ? 'Pass' : '**Fail**'} | ${cell(result.name)} | ${cell(result.detail)} |`);
  const skipped = ready ? '' : '\nThe home page never became ready, so the remaining checks were skipped.\n';
  appendFileSync(summaryFile, `\n### Smoke checks\n\n| Result | Check | Detail |\n| --- | --- | --- |\n${rows.join('\n')}\n${skipped}`);
}
console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
