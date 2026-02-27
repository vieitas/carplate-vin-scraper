# 🚀 DEPLOY EM 3 PASSOS - SUA API NO AR AGORA!

## ✅ Seu código JÁ ESTÁ PRONTO!

Eu já preparei tudo. Agora você só precisa seguir 3 passos simples:

---

## 📋 PASSO 1: Criar Repositório no GitHub (1 minuto)

### Abra este link no navegador:

```
https://github.com/new
```

### Preencha:

- **Repository name:** `carplate-vin-scraper`
- **Description:** `API de Web Scraping para buscar VIN`
- **Public** ✅ (deixe marcado)
- **NÃO marque** "Add a README file"

### Clique em: **"Create repository"**

✅ **Pronto! Repositório criado.**

---

## 📋 PASSO 2: Enviar Código para GitHub (1 minuto)

### Copie e cole estes comandos no PowerShell:

```powershell
cd C:\Users\vieit\OneDrive\Desktop\CarPlate

git remote add origin https://github.com/vieitas/carplate-vin-scraper.git

git branch -M main

git push -u origin main
```

**Se pedir usuário e senha:**
- **Username:** vieitas
- **Password:** Use um Personal Access Token (não a senha normal)
  - Crie em: https://github.com/settings/tokens
  - Ou use GitHub Desktop se preferir

✅ **Pronto! Código no GitHub.**

---

## 📋 PASSO 3: Deploy no Render (2 minutos)

### 1. Acesse:

```
https://dashboard.render.com/register
```

### 2. Clique em **"Sign up with GitHub"**

### 3. Autorize o Render

### 4. Clique em **"New +"** → **"Web Service"**

### 5. Conecte seu repositório:

- Procure por: `carplate-vin-scraper`
- Clique em **"Connect"**

### 6. Configure:

- **Name:** `carplate-vin-scraper`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Instance Type:** `Free` ✅

### 7. Clique em **"Create Web Service"**

### 8. Aguarde 2 minutos...

✅ **PRONTO! SUA API ESTÁ NO AR! 🎉**

---

## 🌐 SUA URL SERÁ:

```
https://carplate-vin-scraper.onrender.com
```

### Teste agora:

**Health Check:**
```
https://carplate-vin-scraper.onrender.com/health
```

**Buscar VIN:**
```
https://carplate-vin-scraper.onrender.com/vin?plate=ABC123&state=CA
```

---

## ⚡ ALTERNATIVA MAIS RÁPIDA: Render Blueprint

Se quiser pular o GitHub, use este link direto:

```
https://render.com/deploy?repo=https://github.com/vieitas/carplate-vin-scraper
```

(Depois de criar o repositório no GitHub)

---

## 🆘 PROBLEMAS?

### "git push" pede senha:

**Solução 1:** Use GitHub Desktop
- Baixe: https://desktop.github.com
- File → Add Local Repository
- Escolha: `C:\Users\vieit\OneDrive\Desktop\CarPlate`
- Publish repository

**Solução 2:** Crie Personal Access Token
1. https://github.com/settings/tokens
2. Generate new token (classic)
3. Marque: `repo`
4. Copie o token
5. Use como senha no git push

### "Repository not found":

- Certifique-se de criar o repositório primeiro no passo 1

### Deploy falhou no Render:

- Verifique os logs no Render
- Geralmente é só aguardar mais um pouco

---

## 📊 STATUS ATUAL:

- ✅ Código pronto
- ✅ Git inicializado
- ✅ Commit feito
- ⏳ Aguardando: Push para GitHub
- ⏳ Aguardando: Deploy no Render

---

## 🎯 RESUMO:

1. **GitHub.com/new** → Criar repositório
2. **PowerShell** → `git push`
3. **Render.com** → Deploy automático

**Tempo total: 4 minutos**

---

**Me avise quando terminar cada passo ou se tiver alguma dúvida!** 🚀

