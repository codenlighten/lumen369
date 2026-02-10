#!/bin/bash

# PM2 Deployment script for lumen-coder to droplet
# Usage: ./deploy-pm2.sh

DROPLET_IP="159.89.130.149"
DROPLET_USER="root"
APP_DIR="/opt/lumen-coder"
APP_NAME="lumen-telegram"

echo "🚀 Deploying ${APP_NAME} to droplet via PM2..."

# Push latest code to GitHub
echo "📤 Pushing to GitHub..."
git add -A
git commit -m "Auto-deploy $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"
git push

# SSH and deploy
echo "🔧 Deploying on droplet..."
ssh ${DROPLET_USER}@${DROPLET_IP} << 'EOF'
  set -e
  
  cd /opt/lumen-coder
  
  echo "📥 Pulling latest code..."
  git pull
  
  echo "📦 Installing dependencies..."
  npm install --production
  
  echo "🔄 Restarting PM2 process..."
  pm2 restart lumen-telegram || pm2 start telegram-bot.js --name lumen-telegram
  
  echo "💾 Saving PM2 state..."
  pm2 save
  
  echo "✅ Deployment complete!"
  pm2 info lumen-telegram
EOF

echo "🎉 Deployment finished!"
echo "📊 Check logs with: ssh ${DROPLET_USER}@${DROPLET_IP} 'pm2 logs ${APP_NAME}'"
