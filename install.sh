#!/bin/bash

echo "🚀 Instalando CarPlate VIN Scraper..."
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "❌ Node.js não está instalado!"
    echo "Por favor, instale Node.js 16+ antes de continuar."
    echo "Visite: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo "✅ npm encontrado: $(npm --version)"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependências instaladas com sucesso!"
else
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo ""

# Instalar dependências do Chrome (Ubuntu/Debian)
if command -v apt-get &> /dev/null
then
    echo "🔧 Detectado sistema Debian/Ubuntu"
    echo "Instalando dependências do Chrome..."
    
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
    
    echo "✅ Dependências do Chrome instaladas!"
fi

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "Para iniciar o servidor:"
echo "  node server.js"
echo ""
echo "Ou com PM2 (recomendado para produção):"
echo "  npm install -g pm2"
echo "  pm2 start ecosystem.config.js"
echo ""

