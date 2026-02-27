# 📖 Exemplos de Uso - CarPlate VIN Scraper

## Como Iniciar o Servidor

### Opção 1: Usando npm (porta padrão 3000)
```bash
npm start
```

### Opção 2: Especificando uma porta customizada

**Windows (PowerShell):**
```powershell
$env:PORT = "9876"
node server.js
```

**Windows (CMD):**
```cmd
set PORT=9876 && node server.js
```

**Linux/Mac:**
```bash
PORT=9876 node server.js
```

### Opção 3: Usando o script start.ps1 (Windows)
```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

## Exemplos de Requisições

### Exemplo 1: Buscar VIN de uma placa da Califórnia

**URL:**
```
http://localhost:9876/vin?plate=ABC123&state=CA
```

**cURL:**
```bash
curl "http://localhost:9876/vin?plate=ABC123&state=CA"
```

**JavaScript (Fetch API):**
```javascript
fetch('http://localhost:9876/vin?plate=ABC123&state=CA')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('VIN encontrado:', data.vin);
    } else {
      console.log('Erro:', data.error);
    }
  })
  .catch(error => console.error('Erro na requisição:', error));
```

**Python (requests):**
```python
import requests

response = requests.get('http://localhost:9876/vin', params={
    'plate': 'ABC123',
    'state': 'CA'
})

data = response.json()
if data.get('success'):
    print(f"VIN: {data['vin']}")
else:
    print(f"Erro: {data['error']}")
```

### Exemplo 2: Buscar VIN de uma placa do Texas

**URL:**
```
http://localhost:9876/vin?plate=XYZ789&state=TX
```

**cURL:**
```bash
curl "http://localhost:9876/vin?plate=XYZ789&state=TX"
```

### Exemplo 3: Buscar VIN de uma placa de Nova York

**URL:**
```
http://localhost:9876/vin?plate=DEF456&state=NY
```

**JavaScript (Axios):**
```javascript
const axios = require('axios');

async function getVIN(plate, state) {
  try {
    const response = await axios.get('http://localhost:9876/vin', {
      params: { plate, state }
    });
    
    if (response.data.success) {
      return response.data.vin;
    } else {
      throw new Error(response.data.error);
    }
  } catch (error) {
    console.error('Erro ao buscar VIN:', error.message);
    return null;
  }
}

// Uso
getVIN('DEF456', 'NY').then(vin => {
  console.log('VIN:', vin);
});
```

## Respostas Esperadas

### Sucesso
```json
{
  "success": true,
  "vin": "1HGBH41JXMN109186",
  "plate": "ABC123",
  "state": "CA",
  "source": "url"
}
```

### VIN não encontrado
```json
{
  "success": false,
  "error": "VIN não encontrado",
  "plate": "ABC123",
  "state": "CA"
}
```

### Erro de validação - Placa não informada
```json
{
  "success": false,
  "error": "Parâmetro \"plate\" é obrigatório"
}
```

### Erro de validação - Estado não informado
```json
{
  "success": false,
  "error": "Parâmetro \"state\" é obrigatório"
}
```

### Erro de validação - Estado inválido
```json
{
  "success": false,
  "error": "Estado inválido. Use uma sigla válida de estado dos EUA (ex: CA, NY, TX)",
  "validStates": ["AL", "AK", "AZ", ...]
}
```

### Erro de validação - Placa inválida
```json
{
  "success": false,
  "error": "Placa inválida. Use apenas letras, números e espaços"
}
```

## Testando a API

### Verificar se o servidor está rodando
```bash
curl http://localhost:9876/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T12:00:00.000Z"
}
```

### Ver informações da API
```bash
curl http://localhost:9876/
```

## Integração com Frontend

### Exemplo HTML + JavaScript
```html
<!DOCTYPE html>
<html>
<head>
    <title>VIN Lookup</title>
</head>
<body>
    <h1>Buscar VIN por Placa</h1>
    
    <form id="vinForm">
        <label>Placa: <input type="text" id="plate" required></label><br>
        <label>Estado: 
            <select id="state" required>
                <option value="">Selecione...</option>
                <option value="CA">California</option>
                <option value="TX">Texas</option>
                <option value="NY">New York</option>
                <!-- Adicione mais estados conforme necessário -->
            </select>
        </label><br>
        <button type="submit">Buscar VIN</button>
    </form>
    
    <div id="result"></div>
    
    <script>
        document.getElementById('vinForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const plate = document.getElementById('plate').value;
            const state = document.getElementById('state').value;
            const resultDiv = document.getElementById('result');
            
            resultDiv.innerHTML = 'Buscando...';
            
            try {
                const response = await fetch(`http://localhost:9876/vin?plate=${plate}&state=${state}`);
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = `<strong>VIN encontrado:</strong> ${data.vin}`;
                } else {
                    resultDiv.innerHTML = `<strong>Erro:</strong> ${data.error}`;
                }
            } catch (error) {
                resultDiv.innerHTML = `<strong>Erro:</strong> ${error.message}`;
            }
        });
    </script>
</body>
</html>
```

## Notas Importantes

1. **Tempo de resposta**: O scraping pode levar de 10 a 30 segundos dependendo da velocidade da internet e do tempo de resposta do GoodCar.com.

2. **Rate limiting**: Evite fazer muitas requisições seguidas para não ser bloqueado pelo site de origem.

3. **Dados reais**: Para testar com dados reais, você precisará de placas válidas de veículos registrados nos EUA.

4. **CORS**: A API já está configurada com CORS habilitado, permitindo requisições de qualquer origem.

