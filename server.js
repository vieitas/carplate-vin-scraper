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

    // Aguardar um pouco para garantir que a página carregou
    await wait(2000);

    // Clicar no tab de License Plate
    await page.waitForSelector('#licenseTab-main', { visible: true });
    await page.click('#licenseTab-main');

    await wait(1000);

    // Preencher o campo de placa
    await page.waitForSelector('#search-platemain', { visible: true });
    await page.type('#search-platemain', plate);

    // Selecionar o estado
    await page.waitForSelector('#searchplateform-state', { visible: true });
    await page.select('#searchplateform-state', state);

    await wait(1000);

    // Clicar no botão de busca
    const searchButton = await page.$('.btn-search-plate');
    if (!searchButton) {
      throw new Error('Botão de busca não encontrado');
    }

    // Aguardar navegação após clicar no botão
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      searchButton.click()
    ]);

    console.log('Formulário enviado, aguardando resultados...');

    // Aguardar a página de resultados carregar
    await wait(3000);

    // Tentar extrair o VIN da página de resultados
    // O VIN geralmente aparece na URL ou no conteúdo da página
    const currentUrl = page.url();
    console.log('URL atual:', currentUrl);

    // Verificar se há VIN na URL
    const vinFromUrl = currentUrl.match(/vin[\/=]([A-HJ-NPR-Z0-9]{17})/i);
    if (vinFromUrl) {
      return {
        success: true,
        vin: vinFromUrl[1].toUpperCase(),
        plate: plate,
        state: state,
        source: 'url'
      };
    }

    // Tentar encontrar VIN no conteúdo da página
    const vinFromPage = await page.evaluate(() => {
      // Procurar por padrão de VIN (17 caracteres alfanuméricos)
      const bodyText = document.body.innerText;
      const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      return vinMatch ? vinMatch[0] : null;
    });

    if (vinFromPage) {
      return {
        success: true,
        vin: vinFromPage.toUpperCase(),
        plate: plate,
        state: state,
        source: 'page_content'
      };
    }

    // Se não encontrou VIN, verificar se há mensagem de erro
    const errorMessage = await page.evaluate(() => {
      const errorElement = document.querySelector('.error, .alert-danger, .no-results');
      return errorElement ? errorElement.innerText : null;
    });

    if (errorMessage) {
      return {
        success: false,
        error: 'VIN não encontrado',
        message: errorMessage,
        plate: plate,
        state: state
      };
    }

    return {
      success: false,
      error: 'VIN não encontrado na página de resultados',
      plate: plate,
      state: state
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

