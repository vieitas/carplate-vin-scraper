const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function para substituir waitForTimeout (removido no Puppeteer novo)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Middleware
app.use(cors());
app.use(express.json());

// Estados válidos dos EUA
const VALID_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

/**
 * Função para fazer scraping do VIN no GoodCar.com
 * @param {string} plate - Placa do veículo
 * @param {string} state - Estado dos EUA (sigla de 2 letras)
 * @returns {Promise<Object>} - Objeto com VIN e outras informações
 */
async function scrapeVIN(plate, state) {
  let browser;
  
  try {
    // Inicializar navegador
    // Usar chromium otimizado para serverless em produção
    const isProduction = process.env.NODE_ENV === 'production';

    browser = await (isProduction ? puppeteerCore : puppeteer).launch({
      headless: chromium.headless,
      args: isProduction ? chromium.args : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
      executablePath: isProduction
        ? await chromium.executablePath()
        : puppeteer.executablePath(),
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    // Configurar timeout e user agent
    await page.setDefaultNavigationTimeout(90000); // Aumentar timeout para 90s
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Bloquear recursos desnecessários para acelerar
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    console.log(`Acessando GoodCar.com para placa: ${plate}, estado: ${state}`);

    // Navegar para a página principal com timeout maior e waitUntil mais flexível
    await page.goto('https://www.goodcar.com/', {
      waitUntil: 'domcontentloaded', // Mais rápido que networkidle2
      timeout: 90000
    });

    // Clicar no tab de License Plate
    await page.waitForSelector('#licenseTab-main', { visible: true, timeout: 10000 });
    await page.click('#licenseTab-main');

    // Preencher o campo de placa
    await page.waitForSelector('#search-platemain', { visible: true, timeout: 10000 });
    await page.type('#search-platemain', plate, { delay: 10 });

    // Selecionar o estado
    await page.waitForSelector('#searchplateform-state', { visible: true, timeout: 10000 });
    await page.select('#searchplateform-state', state);

    // Clicar no botão de busca
    const searchButton = await page.$('.btn-search-plate');
    if (!searchButton) {
      throw new Error('Botão de busca não encontrado');
    }

    console.log('Enviando formulário...');

    // Aguardar navegação após clicar no botão
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      searchButton.click()
    ]);

    console.log('Página de resultados carregada, buscando VIN...');

    // Tentar extrair o VIN da página de resultados
    const currentUrl = page.url();
    console.log('URL atual:', currentUrl);

    // Método 1: Verificar se há VIN na URL
    const vinFromUrl = currentUrl.match(/vin[\/=]([A-HJ-NPR-Z0-9]{17})/i);
    if (vinFromUrl) {
      console.log('VIN encontrado na URL:', vinFromUrl[1]);
      return {
        success: true,
        vin: vinFromUrl[1].toUpperCase(),
        plate: plate,
        state: state,
        source: 'url'
      };
    }

    // Método 2: Buscar VIN em múltiplos lugares da página
    const vinData = await page.evaluate(() => {
      // Procurar em seletores comuns
      const selectors = [
        '[data-vin]',
        '.vin-number',
        '#vin',
        '.vehicle-vin',
        '[class*="vin"]',
        '[id*="vin"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.getAttribute('data-vin') || element.value;
          const vinMatch = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
          if (vinMatch) return { vin: vinMatch[0], source: 'selector: ' + selector };
        }
      }

      // Procurar no texto completo da página
      const bodyText = document.body.innerText;
      const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      if (vinMatch) return { vin: vinMatch[0], source: 'body_text' };

      // Procurar no HTML
      const htmlMatch = document.documentElement.innerHTML.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      if (htmlMatch) return { vin: htmlMatch[0], source: 'html' };

      return null;
    });

    if (vinData) {
      console.log('VIN encontrado via', vinData.source, ':', vinData.vin);
      return {
        success: true,
        vin: vinData.vin.toUpperCase(),
        plate: plate,
        state: state,
        source: vinData.source
      };
    }

    // Se não encontrou VIN, coletar informações de debug
    const debugInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 500),
        hasError: !!document.querySelector('.error, .alert-danger, .no-results')
      };
    });

    console.log('Debug - Não encontrou VIN:', debugInfo);

    return {
      success: false,
      error: 'VIN não encontrado na página de resultados',
      plate: plate,
      state: state,
      debug: {
        url: debugInfo.url,
        title: debugInfo.title,
        preview: debugInfo.bodyPreview
      }
    };

  } catch (error) {
    console.error('Erro no scraping:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Rota principal - GET /vin
app.get('/vin', async (req, res) => {
  // Aumentar timeout da requisição para 2 minutos
  req.setTimeout(120000);

  try {
    const { plate, state } = req.query;

    // Validações
    if (!plate) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "plate" é obrigatório'
      });
    }

    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "state" é obrigatório'
      });
    }

    const stateUpper = state.toUpperCase();
    if (!VALID_STATES.includes(stateUpper)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Use uma sigla válida de estado dos EUA (ex: CA, NY, TX)`,
        validStates: VALID_STATES
      });
    }

    // Validar formato da placa (alfanumérico e espaços)
    if (!/^[A-Za-z0-9 ]+$/.test(plate)) {
      return res.status(400).json({
        success: false,
        error: 'Placa inválida. Use apenas letras, números e espaços'
      });
    }

    // Executar scraping
    const result = await scrapeVIN(plate.trim(), stateUpper);
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }

  } catch (error) {
    console.error('Erro na rota /vin:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota raiz com instruções
app.get('/', (req, res) => {
  res.json({
    message: 'API de Web Scraping - GoodCar VIN Lookup',
    usage: 'GET /vin?plate=ABC123&state=CA',
    endpoints: {
      '/vin': 'Buscar VIN por placa e estado',
      '/health': 'Verificar status da API'
    },
    example: `${req.protocol}://${req.get('host')}/vin?plate=ABC123&state=CA`
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Acesse: http://localhost:${PORT}`);
  console.log(`📖 Exemplo: http://localhost:${PORT}/vin?plate=ABC123&state=CA`);
});

