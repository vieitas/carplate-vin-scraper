const express = require('express');
const cors = require('cors');

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

let puppeteer, chromium;
if (IS_PROD) {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  puppeteer = require('puppeteer');
  chromium = null;
}

const app = express();
app.use(cors());
app.use(express.json());

const VALID_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY'
];

const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
function isValidVin(v) {
  return typeof v === 'string' && /^[A-HJ-NPR-Z0-9]{17}$/.test(v) && /[A-HJ-NPR-Z]/.test(v);
}

let _browser = null;
let _launching = false;
const _queue = [];

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_launching) return new Promise((res, rej) => _queue.push({ res, rej }));
  _launching = true;
  try {
    console.log('[browser] launching...');
    const launchOptions = IS_PROD
      ? { headless: chromium.headless, args: chromium.args, executablePath: await chromium.executablePath(), ignoreHTTPSErrors: true }
      : { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'], ignoreHTTPSErrors: true };
    _browser = await puppeteer.launch(launchOptions);
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

async function makePage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image','font','media','stylesheet'].includes(req.resourceType())) return req.abort();
    req.continue();
  });
  return page;
}

// Poll page text/HTML for a valid VIN
function pollPageForVin(page, timeoutMs) {
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs;
    async function poll() {
      try {
        const vin = await page.evaluate(() => {
          const re = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
          const hasLetter = v => /[A-HJ-NPR-Z]/.test(v);
          // Check page visible text
          const text = document.body ? document.body.innerText : '';
          const hits = Array.from(text.matchAll(re), m => m[0]).filter(hasLetter);
          if (hits.length) return hits[0].toUpperCase();
          // Check HTML (catches data attributes etc)
          const html = document.documentElement ? document.documentElement.innerHTML : '';
          const htmlHits = Array.from(html.matchAll(re), m => m[0]).filter(hasLetter);
          return htmlHits.length ? htmlHits[0].toUpperCase() : null;
        });
        if (vin && isValidVin(vin)) { console.log('[poll] VIN in page:', vin); return resolve(vin); }
      } catch {}
      if (Date.now() < deadline) setTimeout(poll, 500);
      else resolve(null);
    }
    poll();
  });
}

async function scrapeVIN(plate, state) {
  const page = await makePage();
  try {
    let vinFromUrl = null;
    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      console.log('[nav]', url.substring(0, 100));
      const m = url.match(/searchVin=([A-HJ-NPR-Z0-9]{17})/i);
      if (m) { vinFromUrl = m[1].toUpperCase(); console.log('[scrape] VIN in URL:', vinFromUrl); }
    });

    console.log('[scrape] loading goodcar homepage...');
    await page.goto('https://www.goodcar.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3500));

    const fillResult = await page.evaluate((p, s) => {
      const plateInput = document.querySelector('#search-platemain');
      if (!plateInput) return 'ERROR: #search-platemain not found';
      const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      inputSetter.call(plateInput, p);
      plateInput.dispatchEvent(new Event('input', { bubbles: true }));
      plateInput.dispatchEvent(new Event('change', { bubbles: true }));
      plateInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      const stateSelect = document.querySelector('#searchplateform-state');
      if (!stateSelect) return 'ERROR: #searchplateform-state not found';
      const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      selectSetter.call(stateSelect, s);
      stateSelect.dispatchEvent(new Event('input', { bubbles: true }));
      stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const form = document.querySelector('form.form-search-plate');
      if (form) form.setAttribute('data-ready-to-submit', 'yes');
      return 'ok plate=' + plateInput.value + ' state=' + stateSelect.value;
    }, plate, state);

    console.log('[scrape] fill:', fillResult);
    if (fillResult.startsWith('ERROR')) throw new Error(fillResult);

    await new Promise(r => setTimeout(r, 500));

    const clickResult = await page.evaluate(() => {
      const btn = document.querySelector('button.btn-search-plate');
      if (btn) { btn.click(); return 'btn.click'; }
      const form = document.querySelector('form.form-search-plate');
      if (form) { form.submit(); return 'form.submit'; }
      return 'nothing found';
    });
    console.log('[scrape] submit:', clickResult);

    // Race: VIN from URL redirect OR VIN from page text (45s)
    const vin = await Promise.race([
      // Strategy 1: watch URL for searchVin= param (works locally / non-bot sessions)
      new Promise(resolve => {
        const deadline = Date.now() + 45000;
        const check = async () => {
          if (vinFromUrl) return resolve(vinFromUrl);
          const url = page.url();
          const m = url.match(/searchVin=([A-HJ-NPR-Z0-9]{17})/i);
          if (m) return resolve(m[1].toUpperCase());
          if (Date.now() < deadline) setTimeout(check, 300);
          else resolve(null);
        };
        check();
      }),
      // Strategy 2: poll page text for valid VIN (works when GoodCar shows result inline)
      pollPageForVin(page, 45000),
      // Hard timeout
      new Promise(resolve => setTimeout(() => resolve(null), 48000)),
    ]);

    if (vin && isValidVin(vin)) {
      console.log('[scrape] success:', vin);
      return { success: true, vin, plate, state };
    }
    console.log('[scrape] VIN not found. Final URL:', page.url().substring(0, 120));
    return { success: false, error: 'VIN not found for this plate/state', plate, state };
  } finally {
    await page.close().catch(() => {});
  }
}

app.get('/vin', async (req, res) => {
  req.setTimeout(90000);
  const { plate, state } = req.query;
  if (!plate) return res.status(400).json({ success: false, error: 'plate is required' });
  if (!state) return res.status(400).json({ success: false, error: 'state is required' });
  const stateUpper = state.toUpperCase();
  if (!VALID_STATES.includes(stateUpper)) return res.status(400).json({ success: false, error: 'Invalid state: ' + state });
  if (!/^[A-Za-z0-9 ]+$/.test(plate)) return res.status(400).json({ success: false, error: 'Invalid plate format' });
  const started = Date.now();
  try {
    const result = await scrapeVIN(plate.trim(), stateUpper);
    console.log('[route] done in', ((Date.now() - started) / 1000).toFixed(1) + 's');
    return res.json(result);
  } catch (err) {
    console.error('[route /vin] error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/debug', async (_req, res) => {
  const page = await makePage();
  try {
    const navLog = [];
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navLog.push(frame.url()); });
    await page.goto('https://www.goodcar.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3500));
    const info = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body ? document.body.innerText.substring(0, 2000) : 'no body',
      hasPlateInput: !!document.querySelector('#search-platemain'),
      hasStateSelect: !!document.querySelector('#searchplateform-state'),
      hasSearchBtn: !!document.querySelector('button.btn-search-plate'),
      hasForm: !!document.querySelector('form.form-search-plate'),
    }));
    info.navLog = navLog;
    return res.json(info);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  } finally {
    await page.close().catch(() => {});
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), env: IS_PROD ? 'production' : 'development' }));
app.get('/', (_req, res) => res.json({ message: 'CarPlate VIN Scraper', usage: 'GET /vin?plate=ABC123&state=FL' }));

app.listen(PORT, () => console.log('Server on port ' + PORT));