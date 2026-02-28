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

function findVinInText(text) {
  const matches = Array.from(text.matchAll(/\b[A-HJ-NPR-Z0-9]{17}\b/g), m => m[0]);
  return matches.find(isValidVin) || null;
}

async function scrapeVIN(plate, state) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // collect all valid VINs from network responses
  let resolveNetVin;
  const netVinPromise = new Promise(resolve => { resolveNetVin = resolve; });

  page.on('response', async response => {
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json') && !ct.includes('text')) return;
      const text = await response.text().catch(() => '');
      const vin = findVinInText(text);
      if (vin) {
        console.log('[net] valid VIN in response from', response.url().substring(0, 80));
        resolveNetVin(vin.toUpperCase());
      }
    } catch {}
  });

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setDefaultNavigationTimeout(25000);

    // block heavy resources
    await page.setRequestInterception(true);
    page.on('request', req => {
      const rt = req.resourceType();
      if (['image','stylesheet','font','media'].includes(rt)) return req.abort();
      if (/google-analytics|googletagmanager|doubleclick|facebook|hotjar/.test(req.url())) return req.abort();
      req.continue();
    });

    const url = 'https://www.goodcar.com/license-plate/' + state + '/' + plate;
    console.log('[scrape] GET', url);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch (navErr) {
      console.log('[scrape] navigation timeout/error:', navErr.message);
      // still try to extract from whatever loaded
    }

    console.log('[scrape] page url after goto:', page.url());

    // DOM polling: look for valid VIN with letters every 300ms for up to 15s
    const domVinPromise = new Promise(resolve => {
      const deadline = Date.now() + 15000;
      async function poll() {
        try {
          const vin = await page.evaluate(() => {
            const re = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
            const hasLetter = v => /[A-HJ-NPR-Z]/.test(v);
            // selectors first
            for (const sel of ['[data-vin]','.vin-number','#vin','[class*="vin"]','a[href*="/vin/"]']) {
              for (const el of document.querySelectorAll(sel)) {
                const t = (el.textContent || el.getAttribute('data-vin') || el.href || '').trim();
                const m = t.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
                if (m && hasLetter(m[0])) return m[0].toUpperCase();
              }
            }
            const hits = Array.from(document.body.innerText.matchAll(re), m => m[0]);
            const v = hits.find(hasLetter);
            if (v) return v.toUpperCase();
            const htmlHits = Array.from(document.documentElement.innerHTML.matchAll(re), m => m[0]);
            const vh = htmlHits.find(hasLetter);
            return vh ? vh.toUpperCase() : null;
          });
          if (vin) return resolve(vin);
        } catch {}
        if (Date.now() < deadline) setTimeout(poll, 300);
        else resolve(null);
      }
      poll();
    });

    // race: network VIN vs DOM VIN vs 18s hard timeout
    const vin = await Promise.race([
      netVinPromise,
      domVinPromise,
      new Promise(resolve => setTimeout(() => resolve(null), 18000)),
    ]);

    if (vin) {
      console.log('[scrape] VIN found:', vin);
      return { success: true, vin, plate, state };
    }

    console.log('[scrape] VIN not found');
    return { success: false, error: 'VIN not found for this plate/state', plate, state };

  } finally {
    await page.close().catch(() => {});
  }
}

// ── Routes ───────────────────────────────────────────────────────
app.get('/vin', async (req, res) => {
  req.setTimeout(60000);
  const { plate, state } = req.query;
  if (!plate) return res.status(400).json({ success: false, error: 'plate is required' });
  if (!state) return res.status(400).json({ success: false, error: 'state is required' });
  const stateUpper = state.toUpperCase();
  if (!VALID_STATES.includes(stateUpper))
    return res.status(400).json({ success: false, error: 'Invalid state: ' + state });
  if (!/^[A-Za-z0-9 ]+$/.test(plate))
    return res.status(400).json({ success: false, error: 'Invalid plate format' });

  const started = Date.now();
  try {
    const result = await scrapeVIN(plate.trim(), stateUpper);
    console.log('[route] done in', ((Date.now() - started) / 1000).toFixed(1) + 's');
    return result.success ? res.json(result) : res.status(404).json(result);
  } catch (err) {
    console.error('[route /vin] error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (_req, res) => res.json({ message: 'CarPlate VIN Scraper', usage: 'GET /vin?plate=ABC123&state=FL' }));

app.listen(PORT, () => console.log('Server on port ' + PORT));