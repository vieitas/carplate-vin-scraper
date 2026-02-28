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

// VIN must have 17 chars AND at least one letter
function isValidVin(v) {
  return typeof v === 'string'
    && /^[A-HJ-NPR-Z0-9]{17}$/.test(v)
    && /[A-HJ-NPR-Z]/.test(v);
}

// ── Browser Singleton ────────────────────────────────────────────
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
      args: IS_PROD
        ? chromium.args
        : ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
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

// ── Page setup ───────────────────────────────────────────────────
async function setupPage(page) {
  await page.setDefaultNavigationTimeout(60000);
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setRequestInterception(true);
  page.on('request', req => {
    const rt = req.resourceType();
    if (['image','stylesheet','font','media'].includes(rt)) return req.abort();
    if (/google-analytics|googletagmanager|doubleclick|facebook|hotjar|newrelic/.test(req.url()))
      return req.abort();
    req.continue();
  });
}

// ── Extract VIN from page DOM (only valid ones) ──────────────────
async function extractVinFromPage(page) {
  const urlMatch = page.url().match(/vin[\/=]([A-HJ-NPR-Z0-9]{17})/i);
  if (urlMatch && isValidVin(urlMatch[1])) return urlMatch[1].toUpperCase();

  return page.evaluate(() => {
    const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
    function hasLetter(v) { return /[A-HJ-NPR-Z]/i.test(v); }

    // 1. Specific selectors first
    for (const sel of ['[data-vin]','.vin-number','#vin','[class*="vin"]','a[href*="/vin/"]']) {
      for (const el of document.querySelectorAll(sel)) {
        const t = (el.textContent || el.getAttribute('data-vin') || el.href || '').trim();
        const m = t.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
        if (m && hasLetter(m[0])) return m[0].toUpperCase();
      }
    }
    // 2. Scan visible text
    const textMatches = Array.from(document.body.innerText.matchAll(VIN_RE), m => m[0]);
    const validText = textMatches.find(hasLetter);
    if (validText) return validText.toUpperCase();

    // 3. Scan full HTML (last resort)
    const htmlMatches = Array.from(document.documentElement.innerHTML.matchAll(VIN_RE), m => m[0]);
    const validHtml = htmlMatches.find(hasLetter);
    return validHtml ? validHtml.toUpperCase() : null;
  });
}

// ── Wait for a valid VIN to appear in DOM (polls every 500ms) ────
function waitForValidVinInDom(page, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    async function check() {
      try {
        const vin = await extractVinFromPage(page);
        if (vin) return resolve(vin);
        if (Date.now() >= deadline) return resolve(null);
        setTimeout(check, 500);
      } catch { resolve(null); }
    }
    check();
  });
}

// ── Core scraper ─────────────────────────────────────────────────
async function scrapeVIN(plate, state) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Network interception for VIN in API responses
  let resolveNetVin;
  const netVinPromise = new Promise(resolve => { resolveNetVin = resolve; });
  page.on('response', async response => {
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json') && !ct.includes('text')) return;
      const text = await response.text().catch(() => '');
      const matches = Array.from(text.matchAll(/\b[A-HJ-NPR-Z0-9]{17}\b/g), m => m[0]);
      const vin = matches.find(isValidVin);
      if (vin) { console.log('[net] VIN from', response.url()); resolveNetVin(vin.toUpperCase()); }
    } catch {}
  });

  try {
    await setupPage(page);

    // ── Strategy 1: direct URL ────────────────────────────────
    const directUrl = 'https://www.goodcar.com/license-plate/' + state + '/' + plate;
    console.log('[scrape] trying direct URL:', directUrl);
    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const currentUrl = page.url();
    console.log('[scrape] landed on:', currentUrl);

    // Determine if we got a real results page (not a redirect to home or error)
    const isResultsPage = (
      currentUrl.includes('license-plate') &&
      currentUrl.toLowerCase().includes(plate.toLowerCase().replace(/\s+/g,''))
    );

    if (isResultsPage) {
      console.log('[scrape] on results page, waiting up to 25s for VIN...');
      const vin = await Promise.race([
        netVinPromise,
        waitForValidVinInDom(page, 25000),
        new Promise(res => setTimeout(() => res(null), 25000)),
      ]);
      if (vin) { console.log('[scrape] found VIN (direct):', vin); return { success: true, vin, plate, state }; }
      console.log('[scrape] no VIN on direct URL, falling back...');
    } else {
      console.log('[scrape] direct URL redirected away from results page');
    }

    // ── Strategy 2: form-based search ────────────────────────
    console.log('[scrape] trying form search...');
    await page.goto('https://www.goodcar.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForSelector('#licenseTab-main', { visible: true, timeout: 8000 });
      await page.click('#licenseTab-main');
      await page.waitForSelector('#search-platemain', { visible: true, timeout: 8000 });
      await page.type('#search-platemain', plate, { delay: 10 });
      await page.waitForSelector('#searchplateform-state', { visible: true, timeout: 8000 });
      await page.select('#searchplateform-state', state);
      const btn = await page.$('.btn-search-plate');
      if (!btn) throw new Error('search button not found');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        btn.click(),
      ]);
    } catch (formErr) {
      console.log('[scrape] form interaction failed:', formErr.message);
      return { success: false, error: 'VIN not found for this plate/state', plate, state };
    }

    console.log('[scrape] form submitted, waiting up to 25s for VIN...');
    const vin = await Promise.race([
      netVinPromise,
      waitForValidVinInDom(page, 25000),
      new Promise(res => setTimeout(() => res(null), 25000)),
    ]);

    if (vin) { console.log('[scrape] found VIN (form):', vin); return { success: true, vin, plate, state }; }
    return { success: false, error: 'VIN not found for this plate/state', plate, state };

  } finally {
    await page.close().catch(() => {});
  }
}

// ── Routes ───────────────────────────────────────────────────────
app.get('/vin', async (req, res) => {
  req.setTimeout(120000);
  const { plate, state } = req.query;
  if (!plate) return res.status(400).json({ success: false, error: 'plate is required' });
  if (!state) return res.status(400).json({ success: false, error: 'state is required' });
  const stateUpper = state.toUpperCase();
  if (!VALID_STATES.includes(stateUpper))
    return res.status(400).json({ success: false, error: 'Invalid state: ' + state });
  if (!/^[A-Za-z0-9 ]+$/.test(plate))
    return res.status(400).json({ success: false, error: 'Invalid plate format' });
  try {
    const result = await scrapeVIN(plate.trim(), stateUpper);
    return result.success ? res.json(result) : res.status(404).json(result);
  } catch (err) {
    console.error('[route /vin] error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (_req, res) => res.json({ message: 'CarPlate VIN Scraper', usage: 'GET /vin?plate=ABC123&state=FL' }));

app.listen(PORT, () => console.log('Server on port ' + PORT));