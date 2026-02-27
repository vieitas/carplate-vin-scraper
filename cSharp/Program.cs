using CarPlateVinScraper.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Adicionar CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Registrar o serviço de scraping como Singleton
builder.Services.AddSingleton<VinScraperService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.MapControllers();

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
Console.WriteLine($"🚀 Servidor rodando na porta {port}");
Console.WriteLine($"📍 Acesse: http://localhost:{port}");
Console.WriteLine($"📖 Exemplo: http://localhost:{port}/vin?plate=ABC123&state=CA");

app.Run($"http://0.0.0.0:{port}");
