# ⚡ Quick Start - Deploy Rápido

## 🎯 Opção 1: Deploy Mínimo (Apenas 2 arquivos!)

### Arquivos necessários:
```
✅ server.js
✅ package.json
```

### Comandos no servidor:
```bash
# 1. Upload dos arquivos
scp server.js package.json usuario@servidor:/var/www/carplate/

# 2. Conectar ao servidor
ssh usuario@servidor

# 3. Navegar até o diretório
cd /var/www/carplate

# 4. Instalar dependências
npm install

# 5. Iniciar servidor
PORT=8080 node server.js
```

**Pronto! Sua API está rodando em `http://seu-servidor:8080`**

---

## 🚀 Opção 2: Deploy Completo (Recomendado)

### Arquivos necessários:
```
✅ server.js
✅ package.json
✅ ecosystem.config.js
✅ install.sh
✅ README.md
```

### Comandos no servidor:
```bash
# 1. Upload dos arquivos
scp server.js package.json ecosystem.config.js install.sh README.md usuario@servidor:/var/www/carplate/

# 2. Conectar ao servidor
ssh usuario@servidor

# 3. Navegar até o diretório
cd /var/www/carplate

# 4. Dar permissão de execução ao script
chmod +x install.sh

# 5. Executar instalação automática
./install.sh

# 6. Instalar PM2 globalmente
npm install -g pm2

# 7. Iniciar com PM2
pm2 start ecosystem.config.js

# 8. Configurar para iniciar automaticamente
pm2 startup
pm2 save
```

**Pronto! Sua API está rodando em produção com PM2!**

---

## 🌐 Opção 3: Deploy no Heroku

### Arquivos necessários:
```
✅ server.js
✅ package.json
✅ Procfile
```

### Comandos:
```bash
# 1. Instalar Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. Login
heroku login

# 3. Criar app
heroku create nome-do-seu-app

# 4. Inicializar Git (se ainda não tiver)
git init

# 5. Adicionar arquivos
git add server.js package.json Procfile
git commit -m "Deploy inicial"

# 6. Deploy
git push heroku main

# 7. Abrir app
heroku open
```

**Pronto! Sua API está no ar no Heroku!**

---

## 🎨 Opção 4: Deploy no Railway

### Passos:

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo" ou "Empty Project"
5. Se escolher Empty Project:
   - Faça upload de `server.js` e `package.json`
   - Railway detectará automaticamente Node.js
6. Clique em "Deploy"

**Pronto! Railway faz tudo automaticamente!**

---

## 📊 Testar a API

Após o deploy, teste com:

```bash
# Health check
curl http://seu-servidor:8080/health

# Buscar VIN
curl "http://seu-servidor:8080/vin?plate=ABC123&state=CA"
```

Ou no navegador:
```
http://seu-servidor:8080/health
http://seu-servidor:8080/vin?plate=ABC123&state=CA
```

---

## 🆘 Problemas Comuns

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Port already in use"
```bash
# Usar outra porta
PORT=9000 node server.js
```

### Erro: "Puppeteer Chrome not found"
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser

# CentOS/RHEL
sudo yum install -y chromium
```

---

## 📞 Comandos Úteis PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs carplate-api

# Reiniciar
pm2 restart carplate-api

# Parar
pm2 stop carplate-api

# Remover
pm2 delete carplate-api
```

---

## 🎯 Resumo Ultra-Rápido

**Mínimo absoluto:**
1. Upload: `server.js` + `package.json`
2. Executar: `npm install && node server.js`
3. Acessar: `http://servidor:3000/health`

**Tempo estimado: 5 minutos** ⚡

