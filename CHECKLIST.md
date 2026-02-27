# ✅ Checklist de Deploy - CarPlate VIN Scraper

## 📦 Fase 1: Preparação Local

- [ ] Verificar que `server.js` existe
- [ ] Verificar que `package.json` existe
- [ ] Decidir tipo de servidor (VPS, Heroku, Railway, etc.)
- [ ] Ler o guia apropriado em `DEPLOY_GUIDE.md`

---

## 🚀 Fase 2: Upload dos Arquivos

### Para VPS/Servidor Linux:
- [ ] `server.js` - Código principal
- [ ] `package.json` - Dependências
- [ ] `ecosystem.config.js` - Configuração PM2 (opcional)
- [ ] `install.sh` - Script de instalação (opcional)
- [ ] `README.md` - Documentação (opcional)

### Para Heroku:
- [ ] `server.js` - Código principal
- [ ] `package.json` - Dependências
- [ ] `Procfile` - Configuração Heroku
- [ ] `README.md` - Documentação (opcional)

### Para Railway/Render:
- [ ] `server.js` - Código principal
- [ ] `package.json` - Dependências
- [ ] `README.md` - Documentação (opcional)

---

## 🔧 Fase 3: Configuração no Servidor

### VPS/Servidor Linux:

- [ ] Conectar via SSH: `ssh usuario@servidor`
- [ ] Navegar até diretório: `cd /var/www/carplate`
- [ ] Verificar Node.js instalado: `node --version`
- [ ] Verificar npm instalado: `npm --version`
- [ ] Instalar dependências: `npm install`
- [ ] Verificar instalação bem-sucedida
- [ ] Configurar porta (se necessário): `export PORT=8080`

### Heroku:

- [ ] Instalar Heroku CLI
- [ ] Login: `heroku login`
- [ ] Criar app: `heroku create nome-app`
- [ ] Inicializar Git: `git init`
- [ ] Adicionar arquivos: `git add .`
- [ ] Commit: `git commit -m "Deploy"`
- [ ] Push: `git push heroku main`

### Railway:

- [ ] Criar conta em railway.app
- [ ] Criar novo projeto
- [ ] Upload dos arquivos ou conectar Git
- [ ] Aguardar deploy automático

---

## ▶️ Fase 4: Iniciar Aplicação

### Opção A: Modo Simples (Desenvolvimento)
- [ ] Executar: `node server.js`
- [ ] Verificar mensagem: "Servidor rodando na porta..."
- [ ] Manter terminal aberto

### Opção B: Modo Produção (PM2)
- [ ] Instalar PM2: `npm install -g pm2`
- [ ] Iniciar: `pm2 start ecosystem.config.js`
- [ ] Verificar status: `pm2 status`
- [ ] Configurar auto-start: `pm2 startup`
- [ ] Salvar configuração: `pm2 save`

### Opção C: Heroku/Railway (Automático)
- [ ] Aguardar deploy completar
- [ ] Verificar logs se necessário

---

## 🧪 Fase 5: Testes

- [ ] Testar health check: `curl http://servidor:8080/health`
- [ ] Verificar resposta: `{"status":"ok",...}`
- [ ] Testar endpoint raiz: `curl http://servidor:8080/`
- [ ] Testar busca VIN: `curl "http://servidor:8080/vin?plate=ABC123&state=CA"`
- [ ] Verificar logs (se usar PM2): `pm2 logs carplate-api`
- [ ] Testar no navegador: `http://servidor:8080/health`

---

## 🔒 Fase 6: Segurança (Opcional mas Recomendado)

- [ ] Configurar firewall: `sudo ufw allow 8080`
- [ ] Configurar HTTPS/SSL (Let's Encrypt)
- [ ] Adicionar rate limiting
- [ ] Configurar variáveis de ambiente
- [ ] Restringir acesso SSH (apenas chave)
- [ ] Atualizar sistema: `sudo apt update && sudo apt upgrade`

---

## 📊 Fase 7: Monitoramento

- [ ] Configurar logs: `pm2 logs`
- [ ] Verificar uso de memória: `pm2 monit`
- [ ] Configurar alertas (opcional)
- [ ] Documentar URL da API
- [ ] Compartilhar documentação com equipe

---

## 🎯 Verificação Final

### A API está funcionando se:

✅ Health check retorna: `{"status":"ok"}`
✅ Endpoint raiz retorna informações da API
✅ Busca VIN retorna resposta (sucesso ou erro válido)
✅ Servidor reinicia automaticamente após reboot (se PM2)
✅ Logs estão sendo gerados corretamente

---

## 📝 Pós-Deploy

- [ ] Documentar URL da API
- [ ] Atualizar README com URL de produção
- [ ] Testar com dados reais
- [ ] Configurar backup (opcional)
- [ ] Configurar monitoramento de uptime (opcional)
- [ ] Adicionar API à documentação do projeto

---

## 🆘 Troubleshooting

### Se algo der errado:

1. **Verificar logs:**
   ```bash
   # PM2
   pm2 logs carplate-api
   
   # Direto
   node server.js
   ```

2. **Verificar porta:**
   ```bash
   netstat -tulpn | grep :8080
   ```

3. **Verificar processos:**
   ```bash
   ps aux | grep node
   ```

4. **Reinstalar dependências:**
   ```bash
   rm -rf node_modules
   npm install
   ```

5. **Verificar permissões:**
   ```bash
   ls -la
   chmod +x install.sh
   ```

---

## ✨ Sucesso!

Se todos os itens acima estão marcados, sua API está rodando em produção! 🎉

**URL da API:** `http://seu-servidor:8080`

**Endpoints:**
- Health: `http://seu-servidor:8080/health`
- VIN Lookup: `http://seu-servidor:8080/vin?plate=ABC123&state=CA`

---

## 📞 Comandos Rápidos de Referência

```bash
# Iniciar
pm2 start ecosystem.config.js

# Parar
pm2 stop carplate-api

# Reiniciar
pm2 restart carplate-api

# Ver logs
pm2 logs carplate-api

# Ver status
pm2 status

# Monitorar
pm2 monit
```

