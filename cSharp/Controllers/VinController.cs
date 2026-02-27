using Microsoft.AspNetCore.Mvc;
using CarPlateVinScraper.Models;
using CarPlateVinScraper.Services;

namespace CarPlateVinScraper.Controllers
{
    [ApiController]
    [Route("")]
    public class VinController : ControllerBase
    {
        private readonly VinScraperService _scraperService;
        private readonly ILogger<VinController> _logger;

        private static readonly string[] ValidStates = new[]
        {
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
        };

        public VinController(VinScraperService scraperService, ILogger<VinController> logger)
        {
            _scraperService = scraperService;
            _logger = logger;
        }

        [HttpGet]
        public IActionResult GetInfo()
        {
            return Ok(new
            {
                name = "CarPlate VIN Scraper API - C#",
                version = "1.0.0",
                description = "API para buscar VIN a partir de placa de carro usando GoodCar.com",
                endpoints = new
                {
                    health = "/health",
                    vin = "/vin?plate={PLATE}&state={STATE}"
                },
                example = "/vin?plate=ABC123&state=CA"
            });
        }

        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new
            {
                status = "OK",
                timestamp = DateTime.UtcNow,
                service = "CarPlate VIN Scraper - C#"
            });
        }

        [HttpGet("vin")]
        public async Task<IActionResult> GetVin([FromQuery] string? plate, [FromQuery] string? state)
        {
            // Validações
            if (string.IsNullOrWhiteSpace(plate))
            {
                return BadRequest(new
                {
                    success = false,
                    error = "Parâmetro 'plate' é obrigatório"
                });
            }

            if (string.IsNullOrWhiteSpace(state))
            {
                return BadRequest(new
                {
                    success = false,
                    error = "Parâmetro 'state' é obrigatório"
                });
            }

            var stateUpper = state.ToUpper();
            if (!ValidStates.Contains(stateUpper))
            {
                return BadRequest(new
                {
                    success = false,
                    error = "Estado inválido. Use uma sigla válida de estado dos EUA (ex: CA, NY, TX)",
                    validStates = ValidStates
                });
            }

            // Validar formato da placa
            if (!System.Text.RegularExpressions.Regex.IsMatch(plate, @"^[A-Za-z0-9 ]+$"))
            {
                return BadRequest(new
                {
                    success = false,
                    error = "Placa inválida. Use apenas letras, números e espaços"
                });
            }

            _logger.LogInformation($"Requisição recebida - Placa: {plate}, Estado: {stateUpper}");

            // Executar scraping
            var result = await _scraperService.ScrapeVinAsync(plate.Trim(), stateUpper);

            if (result.Success)
            {
                return Ok(result);
            }
            else
            {
                return Ok(result); // Retorna 200 mesmo com erro para manter compatibilidade
            }
        }
    }
}

