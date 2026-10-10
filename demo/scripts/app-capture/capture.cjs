const { chromium } = require(process.env.PW + '/node_modules/playwright');
const out = process.env.OUT;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const fixFonts = async () => { await page.evaluate(async () => { for (const e of document.querySelectorAll('*')) { const f = getComputedStyle(e).fontFamily; if (/system-ui|-apple-system|BlinkMacSystemFont/.test(f)) e.style.fontFamily = 'Roboto, sans-serif'; else if (/^monospace/.test(f)) e.style.fontFamily = '"Roboto Mono", monospace'; } await document.fonts.ready; }); await page.waitForTimeout(350); };
  const open = async (s) => { await page.goto(`http://127.0.0.1:8791/shots?s=${s}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=block' }); await fixFonts(); await page.waitForTimeout(500); };
  const scroller = `(() => { const els = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)); els.sort((a, b) => b.clientHeight - a.clientHeight); return els[0]; })()`;
  const scrollTo = async (y) => { const got = await page.evaluate(`(() => { const s = ${scroller}; if (!s) return -1; s.scrollTop = ${y}; return s.scrollTop; })()`); await page.waitForTimeout(350); return got; };
  const shot = async (name) => { await fixFonts(); await page.screenshot({ path: `${out}/${name}.png` }); };
  const where = async (label) => page.evaluate((l) => { const e = [...document.querySelectorAll('[role=button]')].find(n => (n.getAttribute('aria-label') || n.textContent).includes(l)); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; }, label);
  const log = {};

  await open('projects'); await shot('projects'); log.newProject = await where('Create a new project');

  await open('new'); await shot('new');
  await page.getByPlaceholder('Enter project name...').fill('Café Amihan website');
  await page.getByPlaceholder('Enter project field or domain...').fill('Website');
  await page.getByPlaceholder('Paste client chat, message, or project brief here...').fill('5 pages, right? Home, Menu, About, Gallery, Contact. And a contact form so people can message us. PHP 15,000 ok. Two weeks? Two rounds of revisions is fine.');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(300);
  await shot('new-filled'); log.createDraft = await where('Create scope draft');

  await open('draft'); await shot('draft'); log.draftScroll = await scrollTo(9999); await shot('draft-end'); log.confirm = await where('Release and confirm scope');

  await open('overview'); await shot('overview'); log.addRequest = await where('Add new client request');

  await open('request'); await shot('request');
  await page.getByPlaceholder('Paste message from client or attach files...').fill('Can we add one more thing? Customer accounts, so regulars can log in.');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(300);
  await shot('request-filled'); log.requestScroll = await scrollTo(9999); await shot('request-end'); log.analyze = await where('Analyze request');

  await open('review'); await shot('review'); log.prepare = await where('Prepare change proposal');

  await open('proposal'); await shot('proposal'); log.proposalScroll = await scrollTo(9999); await shot('proposal-end'); log.copy = await where('Copy message');

  console.log(JSON.stringify(log));
  await b.close();
})();
