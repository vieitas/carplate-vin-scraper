# 🚀 Guia de Deploy - CarPlate VIN Scraper

## 📦 Arquivos Necessários para Upload

### ✅ Arquivos OBRIGATÓRIOS (enviar para o servidor):

```
CarPlate/
├── server.js           ✅ OBRIGATÓRIO - Código principal da aplicação
├── package.json        ✅ OBRIGATÓRIO - Dependências do projeto
├── README.md           ✅ RECOMENDADO - Documentação
├── .gitignore          ✅ RECOMENDADO - Se usar Git
└── USAGE_EXAMPLES.md   ⚪ OPCIONAL - Exemplos de uso
```

### ❌ Arquivos que NÃO devem ser enviados:

```
❌ node_modules/        - Será instalado no servidor
❌ .env                 - Criar no servidor com suas configurações
❌ start.ps1            - Script local do Windows
❌ start.bat            - Script local do Windows
❌ .env.example         - Apenas referência local
❌ DEPLOY_GUIDE.md      - Apenas referência local
```

## 📋 Checklist de Deploy

### Passo 1: Preparar arquivos localmente
- [ ] Verificar se `server.js` está correto
- [ ] Verificar se `package.json` está correto
- [ ] Criar arquivo `.env` com configurações do servidor (se necessário)

### Passo 2: Upload para o servidor
- [ ] Fazer upload de `server.js`
- [ ] Fazer upload de `package.json`
- [ ] Fazer upload de `README.md` (opcional)
- [ ] Fazer upload de `.gitignore` (se usar Git)

### Passo 3: Configurar no servidor
- [ ] Conectar via SSH ao servidor
- [ ] Navegar até o diretório do projeto
- [ ] Instalar dependências: `npm install`
- [ ] Configurar variável de ambiente PORT (se necessário)
- [ ] Iniciar o servidor

## 🖥️ Comandos para Executar no Servidor

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar o servidor (modo desenvolvimento)
```bash
# Porta padrão (3000)
node server.js

# Porta customizada
PORT=8080 node server.js
```

### 3. Iniciar o servidor (modo produção com PM2)
```bash
# Instalar PM2 globalmente (apenas uma vez)
npm install -g pm2

# Iniciar aplicação
pm2 start server.js --name "carplate-api"

# Configurar para iniciar automaticamente após reboot
pm2 startup
pm2 save

# Verificar status
pm2 status

# Ver logs
pm2 logs carplate-api

# Parar aplicação
pm2 stop carplate-api

# Reiniciar aplicação
pm2 restart carplate-api
```

## 🌐 Tipos de Servidor e Instruções Específicas

### A) VPS/Servidor Linux (DigitalOcean, AWS EC2, Linode, etc.)

#### Requisitos:
- Node.js 16+ instalado
- npm instalado
- Acesso SSH

#### Passos:

1. **Conectar via SSH:**
```bash
ssh usuario@seu-servidor.com
```

2. **Criar diretório do projeto:**
```bash
mkdir -p /var/www/carplate
cd /var/www/carplate
```

3. **Upload dos arquivos (do seu computador local):**
```bash
# Opção 1: Usando SCP
scp server.js package.json usuario@seu-servidor.com:/var/www/carplate/

# Opção 2: Usando SFTP
sftp usuario@seu-servidor.com
put server.js
put package.json
```

4. **No servidor, instalar dependências:**
```bash
cd /var/www/carplate
npm install
```

5. **Configurar porta (opcional):**
```bash
export PORT=8080
```

6. **Iniciar com PM2:**
```bash
npm install -g pm2
pm2 start server.js --name carplate-api
pm2 save
pm2 startup
```

7. **Configurar firewall:**
```bash
# Permitir porta 8080 (ou a porta que você escolheu)
sudo ufw allow 8080
```

### B) Heroku

#### Arquivos adicionais necessários:
Criar arquivo `Procfile` (sem extensão):
```
web: node server.js
```

#### Passos:

1. **Instalar Heroku CLI**
2. **Login:**
```bash
heroku login
```

3. **Criar app:**
```bash
heroku create nome-do-seu-app
```

4. **Deploy:**
```bash
git init
git add server.js package.json Procfile
git commit -m "Initial commit"
git push heroku main
```

5. **Abrir app:**
```bash
heroku open
```

### C) Vercel

Vercel não é ideal para este projeto pois usa Puppeteer (navegador headless).
Recomendo usar VPS ou Heroku.

### D) Railway

#### Passos:

1. Criar conta em railway.app
2. Criar novo projeto
3. Conectar repositório Git ou fazer upload manual
4. Railway detectará automaticamente o Node.js
5. Configurar variável de ambiente `PORT` (Railway define automaticamente)
6. Deploy automático

### E) Render

#### Passos:

1. Criar conta em render.com
2. Criar novo "Web Service"
3. Conectar repositório ou fazer upload
4. Configurar:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Deploy automático

## 🔧 Configurações Importantes

### Variáveis de Ambiente

Criar arquivo `.env` no servidor (se necessário):
```env
PORT=8080
NODE_ENV=production
```

### Configuração de Porta

O servidor usa a porta definida em `process.env.PORT` ou 3000 por padrão.
A maioria dos serviços de hospedagem define automaticamente a variável PORT.

## 🔒 Segurança

### Recomendações:

1. **Usar HTTPS:** Configure um certificado SSL (Let's Encrypt é gratuito)
2. **Rate Limiting:** Adicione rate limiting para evitar abuso
3. **Firewall:** Configure firewall para permitir apenas portas necessárias
4. **Atualizações:** Mantenha Node.js e dependências atualizadas

### Adicionar Rate Limiting (opcional):

Instalar no servidor:
```bash
npm install express-rate-limit
```

Adicionar no início do `server.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requisições por IP
});

app.use('/vin', limiter);
```

## 📊 Monitoramento

### Verificar se está rodando:
```bash
# Verificar processos Node
ps aux | grep node

# Verificar porta em uso
netstat -tulpn | grep :8080

# Testar endpoint
curl http://localhost:8080/health
```

### Logs com PM2:
```bash
pm2 logs carplate-api
pm2 logs carplate-api --lines 100
```

## 🆘 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Port already in use"
```bash
# Encontrar processo usando a porta
lsof -i :8080
# ou
netstat -tulpn | grep :8080

# Matar processo
kill -9 PID
```

### Erro: "Puppeteer Chrome not found"
```bash
# Instalar dependências do Chrome (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils
```

## 📝 Resumo Rápido

### Arquivos para enviar:
1. ✅ `server.js`
2. ✅ `package.json`
3. ⚪ `README.md` (opcional)

### Comandos no servidor:
```bash
npm install
PORT=8080 node server.js
# ou
pm2 start server.js --name carplate-api
```

### Testar:
```bash
curl http://seu-servidor.com:8080/health
curl "http://seu-servidor.com:8080/vin?plate=ABC123&state=CA"
```

## 🎯 Recomendação Final

Para este projeto, recomendo:
1. **VPS Linux** (DigitalOcean, Linode, AWS EC2) - Melhor controle
2. **Railway** - Mais fácil e rápido
3. **Heroku** - Simples mas pode ter limitações com Puppeteer

Evite: Vercel, Netlify (não suportam bem Puppeteer)

