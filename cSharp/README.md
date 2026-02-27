# 🚗 CarPlate VIN Scraper - C# / ASP.NET Core

API em C# para buscar VIN (Vehicle Identification Number) a partir de placa de carro usando web scraping no GoodCar.com.

## 🛠️ Tecnologias

- **ASP.NET Core 9.0** - Framework web
- **PuppeteerSharp** - Automação de navegador (equivalente ao Puppeteer do Node.js)
- **Swagger/OpenAPI** - Documentação da API

## 📋 Pré-requisitos

- **.NET 9.0 SDK** ou superior
- Windows, Linux ou macOS

## 🚀 Como Executar

### 1. Restaurar dependências

```bash
cd cSharp
dotnet restore
```

### 2. Executar o projeto

```bash
dotnet run
```

O servidor iniciará em `http://localhost:5000`

### 3. Testar a API

**Health Check:**
```
http://localhost:5000/health
```

**Buscar VIN:**
```
http://localhost:5000/vin?plate=ABC123&state=CA
```

**Swagger UI (Documentação):**
```
http://localhost:5000/swagger
```

## 📖 Endpoints

### `GET /`
Retorna informações sobre a API

### `GET /health`
Health check do serviço

### `GET /vin?plate={PLATE}&state={STATE}`
Busca o VIN a partir da placa e estado

**Parâmetros:**
- `plate` (obrigatório): Placa do veículo (alfanumérico)
- `state` (obrigatório): Sigla do estado dos EUA (ex: CA, NY, FL, TX)

**Exemplo de resposta (sucesso):**
```json
{
  "success": true,
  "vin": "1HGBH41JXMN109186",
  "plate": "ABC123",
  "state": "CA",
  "source": "url"
}
```

**Exemplo de resposta (erro):**
```json
{
  "success": false,
  "error": "VIN não encontrado na página de resultados",
  "plate": "ABC123",
  "state": "CA",
  "debug": {
    "url": "https://goodcar.com/...",
    "title": "...",
    "preview": "..."
  }
}
```

## 🏗️ Estrutura do Projeto

```
cSharp/
├── Controllers/
│   └── VinController.cs       # Controller da API
├── Models/
│   └── VinResponse.cs         # Modelos de resposta
├── Services/
│   └── VinScraperService.cs   # Serviço de scraping
├── Program.cs                 # Configuração da aplicação
├── CarPlateVinScraper.csproj  # Arquivo do projeto
└── README.md                  # Este arquivo
```

## 🔧 Build para Produção

```bash
dotnet publish -c Release -o ./publish
```

Os arquivos compilados estarão em `./publish`

## 🐳 Docker (Opcional)

Você pode criar um Dockerfile para containerizar a aplicação:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 5000

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["CarPlateVinScraper.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CarPlateVinScraper.dll"]
```

## 📝 Notas

- Na primeira execução, o PuppeteerSharp baixará o Chromium automaticamente (~150MB)
- O navegador é reutilizado entre requisições para melhor performance
- Recursos desnecessários (imagens, CSS, fontes) são bloqueados para acelerar o scraping

## 🆚 Diferenças da Versão Node.js

- Mesma funcionalidade e endpoints
- Usa PuppeteerSharp ao invés de Puppeteer
- Swagger UI integrado para documentação
- Tipagem forte com C#
- Melhor integração com ambientes Windows/IIS

## 📄 Licença

MIT

