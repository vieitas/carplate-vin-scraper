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

// ── Browser Singleton ──────────────────────────────────────────────────────────
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
      args: IS_PROD ? chromium.args : [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu'
      ],
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

// Warm up the browser on startup so the first real request is fast
getBrowser().catch(e => console.error('[browser] warmup error:', e.message));

// ── Scraping ───────────────────────────────────────────────────────────────────
async function scrapeVIN(plate, state) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setDefaultNavigationTimeout(90000);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Block heavy resources
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    console.log(`[scrape] ${plate} / ${state}`);
    await page.goto('https://www.goodcar.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });

    await page.waitForSelector('#licenseTab-main', { visible: true, timeout: 10000 });
    await page.click('#licenseTab-main');
    await page.waitForSelector('#search-platemain', { visible: true, timeout: 10000 });
    await page.type('#search-platemain', plate, { delay: 10 });
    await page.waitForSelector('#searchplateform-state', { visible: true, timeout: 10000 });
    await page.select('#searchplateform-state', state);

    const searchButton = await page.$('.btn-search-plate');
    if (!searchButton) throw new Error('Search button not found');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      searchButton.click()
    ]);

    // Wait for VIN to appear OR "Please wait" to disappear (max 45s)
    try {
      await page.waitForFunction(
        () => {
          const vinMatch = document.documentElement.innerHTML.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
          if (vinMatch) return true;
          return !document.body.innerText.includes('Please wait. This should take only a few seconds.');
        },
        { timeout: 45000 }
      );
    } catch (e) {
      console.log('[scrape] waitForFunction timeout, trying anyway...');
    }

    const currentUrl = page.url();

    // Method 1: VIN in URL
    const vinFromUrl = currentUrl.match(/vin[\/=]([A-HJ-NPR-Z0-9]{17})/i);
    if (vinFromUrl) {
      console.log('[scrape] VIN from URL:', vinFromUrl[1]);
      return { success: true, vin: vinFromUrl[1].toUpperCase(), plate, state };
    }

    // Method 2: VIN in page
    const vinData = await page.evaluate(() => {
      const selectors = ['[data-vin]','.vin-number','#vin','.vehicle-vin','[class*="vin"]','[id*="vin"]','a[href*="/vin/"]'];
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          const text = el.textContent || el.getAttribute('data-vin') || el.href || '';
          const m = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
          if (m) return { vin: m[0], src: sel };
        }
      }
      const bodyMatch = document.body.innerText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      if (bodyMatch) return { vin: bodyMatch[0], src: 'body' };
      const htmlMatch = document.documentElement.innerHTML.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      if (htmlMatch) return { vin: htmlMatch[0], src: 'html' };
      return null;
    });

    if (vinData) {
      console.log('[scrape] VIN via', vinData.src, ':', vinData.vin);
      return { success: true, vin: vinData.vin.toUpperCase(), plate, state };
    }

    return { success: false, error: 'VIN not found', plate, state };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────
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

app.get('/', (req, res) => res.json({
  message: 'CarPlate VIN Scraper',
  usage: 'GET /vin?plate=ABC123&state=FL',
  example: `${req.protocol}://${req.get('host')}/vin?plate=RYCP81&state=FL`
}));

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
