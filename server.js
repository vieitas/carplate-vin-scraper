const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

const VALID_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY'
];

const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/;
function isValidVin(v) { return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) && /[A-HJ-NPR-Z]/.test(v); }

// Browser Singleton
let _browser = null;
let _launching = false;
const _queue = [];

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_launching) return new Promise((res, rej) => _queue.push({ res, rej }));
  _launching = true;
  try {
    console.log('[browser] launching...');
    _browser = await (IS_PROD ? puppeteerCore : puppeteer).launch({
      headless: IS_PROD ? chromium.headless : true,
      args: IS_PROD ? chromium.args : ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
      executablePath: IS_PROD ? await chromium.executablePath() : puppeteer.executablePath(),
      ignoreHTTPSErrors: true,
    });
    _browser.on('disconnected', () => { _browser = null; console.log('[browser] disconnected'); });
    console.log('[browser] ready');
    _queue.forEach(({ res }) => res(_browser));
    _queue.length = 0;
    return _browser;
  } catch (err) {
    _queue.forEach(({ rej }) => rej(err));
    _queue.length = 0;
    throw err;
  } finally {
    _launching = false;
  }
}

getBrowser().catch(e => console.error('[browser] warmup error:', e.message));

async function setupPage(page) {
  await page.setDefaultNavigationTimeout(90000);
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setRequestInterception(true);
  page.on('request', req => {
    const rt = req.resourceType();
    const url = req.url();
    if (['image','stylesheet','font','media'].includes(rt)) return req.abort();
    if (/google-analytics|googletagmanager|doubleclick|facebook|hotjar|newrelic/.test(url)) return req.abort();
    req.continue();
  });
}

async function extractVinFromPage(page) {
  const urlVin = page.url().match(/vin[/=]([A-HJ-NPR-Z0-9]{17})/i);
  if (urlVin) return urlVin[1].toUpperCase();
  return page.evaluate(() => {
    for (const sel of ['[data-vin]','.vin-number','#vin','[class*="vin"]','[id*="vin"]','a[href*="/vin/"]']) {
      for (const el of document.querySelectorAll(sel)) {
        const t = el.textContent || el.getAttribute('data-vin') || el.href || '';
        const m = t.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
        if (m) return m[0].toUpperCase();
      }
    }
    const all = Array.from(document.body.innerText.matchAll(/\b[A-HJ-NPR-Z0-9]{17}\b/g)).map(m => m[0]);
    const valid = all.find(v => /[A-HJ-NPR-Z]/.test(v));
    if (valid) return valid.toUpperCase();
    const allHtml = Array.from(document.documentElement.innerHTML.matchAll(/\b[A-HJ-NPR-Z0-9]{17}\b/g)).map(m => m[0]);
    const validHtml = allHtml.find(v => /[A-HJ-NPR-Z]/.test(v));
    return validHtml ? validHtml.toUpperCase() : null;
  });
}

async function scrapeVIN(plate, state) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  let resolveNetVin;
  const netVinPromise = new Promise(resolve => { resolveNetVin = resolve; });
  page.on('response', async response => {
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json') && !ct.includes('text')) return;
      const text = await response.text().catch(() => '');
      const m = text.match(VIN_RE);
      if (m && isValidVin(m[0])) { console.log('[net] VIN from', response.url()); resolveNetVin(m[0].toUpperCase()); }
    } catch {}
  });

  try {
    await setupPage(page);

    const directUrl = 'https://www.goodcar.com/license-plate/' + state + '/' + plate;
    console.log('[scrape] direct ->', directUrl);
    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    const afterGoto = page.url();
    const onResults = afterGoto.includes('license-plate') || afterGoto.toLowerCase().includes(plate.toLowerCase());
    if (!onResults) {
      console.log('[scrape] direct URL redirected, falling back to form...');
      await page.goto('https://www.goodcar.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('#licenseTab-main', { visible: true, timeout: 10000 });
      await page.click('#licenseTab-main');
      await page.waitForSelector('#search-platemain', { visible: true, timeout: 10000 });
      await page.type('#search-platemain', plate, { delay: 10 });
      await page.waitForSelector('#searchplateform-state', { visible: true, timeout: 10000 });
      await page.select('#searchplateform-state', state);
      const btn = await page.$('.btn-search-plate');
      if (!btn) throw new Error('Search button not found');
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }), btn.click()]);
    }

    const vin = await Promise.race([
      netVinPromise,
      (async () => {
        try {
          await page.waitForFunction(() => !!document.documentElement.innerHTML.match(/\b[A-HJ-NPR-Z0-9]{17}\b/), { timeout: 60000 });
          return extractVinFromPage(page);
        } catch { return null; }
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('scrape timeout')), 90000)),
    ]);

    if (vin) { console.log('[scrape] VIN:', vin); return { success: true, vin, plate, state }; }
    return { success: false, error: 'VIN not found', plate, state };
  } finally {
    await page.close().catch(() => {});
  }
}

app.get('/vin', async (req, res) => {
  req.setTimeout(120000);
  const { plate, state } = req.query;
  if (!plate) return res.status(400).json({ success: false, error: 'plate is required' });
  if (!state) return res.status(400).json({ success: false, error: 'state is required' });
  const stateUpper = state.toUpperCase();
  if (!VALID_STATES.includes(stateUpper)) return res.status(400).json({ success: false, error: 'Invalid state' });
  if (!/^[A-Za-z0-9 ]+$/.test(plate)) return res.status(400).json({ success: false, error: 'Invalid plate format' });
  try {
    const result = await scrapeVIN(plate.trim(), stateUpper);
    return result.success ? res.json(result) : res.status(404).json(result);
  } catch (err) {
    console.error('[route /vin]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ message: 'CarPlate VIN Scraper', usage: 'GET /vin?plate=ABC123&state=FL' }));

app.listen(PORT, () => console.log('Server on port ' + PORT));