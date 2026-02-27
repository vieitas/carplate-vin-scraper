using PuppeteerSharp;
using CarPlateVinScraper.Models;
using System.Text.RegularExpressions;

namespace CarPlateVinScraper.Services
{
    public class VinScraperService
    {
        private readonly ILogger<VinScraperService> _logger;
        private static IBrowser? _browser;
        private static readonly SemaphoreSlim _semaphore = new(1, 1);

        public VinScraperService(ILogger<VinScraperService> logger)
        {
            _logger = logger;
        }

        public async Task<VinResponse> ScrapeVinAsync(string plate, string state)
        {
            IPage? page = null;
            try
            {
                // Garantir que o browser está inicializado
                await EnsureBrowserAsync();

                page = await _browser!.NewPageAsync();

                // Configurar timeout e user agent
                page.DefaultNavigationTimeout = 90000;
                await page.SetUserAgentAsync("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                // Bloquear recursos desnecessários para acelerar
                await page.SetRequestInterceptionAsync(true);
                page.Request += async (sender, e) =>
                {
                    var resourceType = e.Request.ResourceType;
                    if (resourceType == ResourceType.Image || 
                        resourceType == ResourceType.StyleSheet || 
                        resourceType == ResourceType.Font || 
                        resourceType == ResourceType.Media)
                    {
                        await e.Request.AbortAsync();
                    }
                    else
                    {
                        await e.Request.ContinueAsync();
                    }
                };

                _logger.LogInformation($"Acessando GoodCar.com para placa: {plate}, estado: {state}");

                // Navegar para a página principal
                await page.GoToAsync("https://www.goodcar.com/", new NavigationOptions
                {
                    WaitUntil = new[] { WaitUntilNavigation.DOMContentLoaded },
                    Timeout = 90000
                });

                // Clicar no tab de License Plate
                await page.WaitForSelectorAsync("#licenseTab-main", new WaitForSelectorOptions { Visible = true, Timeout = 10000 });
                await page.ClickAsync("#licenseTab-main");

                // Preencher o campo de placa
                await page.WaitForSelectorAsync("#search-platemain", new WaitForSelectorOptions { Visible = true, Timeout = 10000 });
                await page.TypeAsync("#search-platemain", plate);

                // Selecionar o estado
                await page.WaitForSelectorAsync("#searchplateform-state", new WaitForSelectorOptions { Visible = true, Timeout = 10000 });
                await page.SelectAsync("#searchplateform-state", state);

                // Clicar no botão de busca
                var searchButton = await page.QuerySelectorAsync(".btn-search-plate");
                if (searchButton == null)
                {
                    throw new Exception("Botão de busca não encontrado");
                }

                _logger.LogInformation("Enviando formulário...");

                // Clicar e aguardar navegação
                await Task.WhenAll(
                    page.WaitForNavigationAsync(new NavigationOptions { WaitUntil = new[] { WaitUntilNavigation.DOMContentLoaded }, Timeout = 60000 }),
                    searchButton.ClickAsync()
                );

                _logger.LogInformation("Página de resultados carregada, aguardando processamento...");

                // Aguardar a página processar a busca
                try
                {
                    await page.WaitForFunctionAsync(@"
                        () => {
                            const bodyText = document.body.innerText;
                            return !bodyText.includes('Please wait. This should take only a few seconds.');
                        }
                    ", new WaitForFunctionOptions { Timeout = 30000 });
                    _logger.LogInformation("Processamento concluído, buscando VIN...");
                }
                catch
                {
                    _logger.LogWarning("Timeout aguardando processamento, tentando buscar VIN mesmo assim...");
                }

                // Tentar extrair o VIN
                var currentUrl = page.Url;
                _logger.LogInformation($"URL atual: {currentUrl}");

                // Método 1: Verificar VIN na URL
                var vinFromUrl = Regex.Match(currentUrl, @"vin[/=]([A-HJ-NPR-Z0-9]{17})", RegexOptions.IgnoreCase);
                if (vinFromUrl.Success)
                {
                    _logger.LogInformation($"VIN encontrado na URL: {vinFromUrl.Groups[1].Value}");
                    return new VinResponse
                    {
                        Success = true,
                        Vin = vinFromUrl.Groups[1].Value.ToUpper(),
                        Plate = plate,
                        State = state,
                        Source = "url"
                    };
                }

                // Método 2: Buscar VIN na página
                var vinData = await page.EvaluateFunctionAsync<VinSearchResult>(@"
                    () => {
                        const selectors = [
                            '[data-vin]',
                            '.vin-number',
                            '#vin',
                            '.vehicle-vin',
                            '[class*=""vin""]',
                            '[id*=""vin""]',
                            'a[href*=""/vin/""]',
                            '.vehicle-info',
                            '.car-details'
                        ];
                        
                        for (const selector of selectors) {
                            const elements = document.querySelectorAll(selector);
                            for (const element of elements) {
                                const text = element.textContent || element.getAttribute('data-vin') || element.value || element.href || '';
                                const vinMatch = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
                                if (vinMatch) return { vin: vinMatch[0], source: 'selector: ' + selector };
                            }
                        }

                        const bodyText = document.body.innerText;
                        const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
                        if (vinMatch) return { vin: vinMatch[0], source: 'body_text' };

                        const htmlMatch = document.documentElement.innerHTML.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
                        if (htmlMatch) return { vin: htmlMatch[0], source: 'html' };

                        return null;
                    }
                ");

                if (vinData != null && !string.IsNullOrEmpty(vinData.Vin))
                {
                    _logger.LogInformation($"VIN encontrado via {vinData.Source}: {vinData.Vin}");
                    return new VinResponse
                    {
                        Success = true,
                        Vin = vinData.Vin.ToUpper(),
                        Plate = plate,
                        State = state,
                        Source = vinData.Source
                    };
                }

                // Se não encontrou VIN, coletar informações de debug
                var debugInfo = await page.EvaluateFunctionAsync<DebugInfo>(@"
                    () => {
                        return {
                            url: window.location.href,
                            title: document.title,
                            preview: document.body.innerText.substring(0, 500)
                        };
                    }
                ");

                _logger.LogWarning($"VIN não encontrado. Debug: {debugInfo.Url}");

                return new VinResponse
                {
                    Success = false,
                    Error = "VIN não encontrado na página de resultados",
                    Plate = plate,
                    State = state,
                    Debug = debugInfo
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Erro no scraping: {ex.Message}");
                return new VinResponse
                {
                    Success = false,
                    Error = "Erro interno do servidor",
                    Plate = plate,
                    State = state
                };
            }
            finally
            {
                if (page != null)
                {
                    await page.CloseAsync();
                }
            }
        }

        private async Task EnsureBrowserAsync()
        {
            if (_browser != null) return;

            await _semaphore.WaitAsync();
            try
            {
                if (_browser != null) return;

                _logger.LogInformation("Baixando Chromium...");
                var browserFetcher = new BrowserFetcher();
                await browserFetcher.DownloadAsync();

                _logger.LogInformation("Iniciando browser...");
                _browser = await Puppeteer.LaunchAsync(new LaunchOptions
                {
                    Headless = true,
                    Args = new[]
                    {
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--disable-gpu"
                    }
                });
                _logger.LogInformation("Browser iniciado com sucesso!");
            }
            finally
            {
                _semaphore.Release();
            }
        }

        private class VinSearchResult
        {
            public string? Vin { get; set; }
            public string? Source { get; set; }
        }
    }
}

