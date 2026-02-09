# 🚗 CarPlate VIN Scraper

Sistema de Web Scraping para obter o VIN (Vehicle Identification Number) a partir da placa do carro usando o site GoodCar.com como fonte de dados.

## 📋 Descrição

Esta API permite que você consulte o VIN de um veículo informando apenas a placa e o estado dos EUA. O sistema utiliza web scraping automatizado com Puppeteer para buscar as informações no GoodCar.com.

## 🚀 Instalação

### Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn

### Passos

1. Clone ou navegue até o diretório do projeto:
```bash
cd CarPlate
```

2. Instale as dependências:
```bash
npm install
```

## 💻 Uso

### Iniciar o servidor

```bash
npm start
```

Ou para desenvolvimento com auto-reload:
```bash
npm run dev
```

O servidor iniciará na porta 3000 por padrão.

### Fazer uma requisição

#### Endpoint principal

```
GET /vin?plate={PLACA}&state={ESTADO}
```

#### Parâmetros

- `plate` (obrigatório): Placa do veículo (alfanumérico, pode conter espaços)
- `state` (obrigatório): Sigla do estado dos EUA (2 letras, ex: CA, NY, TX)

#### Exemplos de requisição

**Usando curl:**
```bash
curl "http://localhost:3000/vin?plate=ABC123&state=CA"
```

**Usando navegador:**
```
http://localhost:3000/vin?plate=ABC123&state=CA
```

**Usando JavaScript (fetch):**
```javascript
fetch('http://localhost:3000/vin?plate=ABC123&state=CA')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Respostas

#### Sucesso (200)
```json
{
  "success": true,
  "vin": "1HGBH41JXMN109186",
  "plate": "ABC123",
  "state": "CA",
  "source": "url"
}
```

#### VIN não encontrado (404)
```json
{
  "success": false,
  "error": "VIN não encontrado",
  "plate": "ABC123",
  "state": "CA"
}
```

#### Erro de validação (400)
```json
{
  "success": false,
  "error": "Parâmetro 'plate' é obrigatório"
}
```

#### Erro interno (500)
```json
{
  "success": false,
  "error": "Erro interno do servidor",
  "message": "Detalhes do erro"
}
```

## 📚 Endpoints disponíveis

### GET /
Retorna informações sobre a API e exemplos de uso.

### GET /vin
Busca o VIN de um veículo por placa e estado.

### GET /health
Verifica o status da API.

```bash
curl http://localhost:3000/health
```

Resposta:
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

## 🌎 Estados válidos

A API aceita as seguintes siglas de estados dos EUA:

AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY

## ⚙️ Tecnologias utilizadas

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **Puppeteer** - Automação de navegador para web scraping
- **CORS** - Middleware para habilitar CORS

## 🔧 Configuração

### Variáveis de ambiente

Você pode configurar a porta do servidor através da variável de ambiente `PORT`:

```bash
PORT=8080 npm start
```

## ⚠️ Avisos importantes

1. **Uso responsável**: Este sistema faz web scraping do site GoodCar.com. Use de forma responsável e respeite os termos de serviço do site.

2. **Rate limiting**: Evite fazer muitas requisições em curto período de tempo para não sobrecarregar o servidor de origem.

3. **Manutenção**: Se o GoodCar.com alterar a estrutura do site, o scraper pode parar de funcionar e precisará ser atualizado.

4. **Dados**: A precisão dos dados depende da disponibilidade e qualidade das informações no GoodCar.com.

## 🐛 Troubleshooting

### Erro ao instalar Puppeteer

Se houver problemas ao instalar o Puppeteer, tente:

```bash
npm install puppeteer --unsafe-perm=true --allow-root
```

### Timeout nas requisições

Se as requisições estão demorando muito ou dando timeout:
- Verifique sua conexão com a internet
- O site GoodCar.com pode estar lento ou indisponível
- Aumente o timeout no código se necessário

## 📝 Licença

ISC

## 👨‍💻 Desenvolvimento

Para contribuir ou modificar o projeto:

1. O arquivo principal é `server.js`
2. As dependências estão listadas em `package.json`
3. Use `npm run dev` para desenvolvimento com auto-reload

## 📞 Suporte

Para problemas ou dúvidas, verifique:
- Os logs do console ao executar o servidor
- Se os parâmetros estão sendo enviados corretamente
- Se o GoodCar.com está acessível

