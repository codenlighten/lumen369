#!/bin/bash

# Deployment script for lumen-coder to droplet
# Usage: ./deploy.sh [version]

VERSION=${1:-latest}
DROPLET_IP="159.89.130.149"
DROPLET_USER="root"
APP_NAME="lumen-coder"
DEPLOY_DIR="/opt/${APP_NAME}"

echo "🚀 Deploying ${APP_NAME} version ${VERSION} to droplet..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t ${APP_NAME}:${VERSION} .

# Save the image to a tarball
echo "💾 Saving image to tarball..."
docker save ${APP_NAME}:${VERSION} | gzip > ${APP_NAME}-${VERSION}.tar.gz

# Copy to droplet
echo "📤 Uploading to droplet..."
scp ${APP_NAME}-${VERSION}.tar.gz ${DROPLET_USER}@${DROPLET_IP}:/tmp/

# SSH and deploy
echo "🔧 Deploying on droplet..."
ssh ${DROPLET_USER}@${DROPLET_IP} << EOF
  set -e
  
  # Create deploy directory if it doesn't exist
  mkdir -p ${DEPLOY_DIR}
  mkdir -p ${DEPLOY_DIR}/data
  
  # Create empty files if they don't exist
  touch ${DEPLOY_DIR}/memory.json
  touch ${DEPLOY_DIR}/audit.log
  
  # Load the Docker image
  echo "Loading Docker image..."
  docker load < /tmp/${APP_NAME}-${VERSION}.tar.gz
  
  # Stop and remove old container if exists
  echo "Stopping old container..."
  docker stop ${APP_NAME} 2>/dev/null || true
  docker rm ${APP_NAME} 2>/dev/null || true
  
  # Run new container
  echo "Starting new container..."
  docker run -d \
    --name ${APP_NAME} \
    --restart unless-stopped \
    -e OPENAI_API_KEY=\${OPENAI_API_KEY} \
    -e OPENAI_DEFAULT_MODEL=gpt-4o-mini \
    -e OPENAI_DEFAULT_TEMPERATURE=0.1 \
    -v ${DEPLOY_DIR}/memory.json:/app/memory.json \
    -v ${DEPLOY_DIR}/audit.log:/app/audit.log \
    -v ${DEPLOY_DIR}/data:/app/data \
    -p 3000:3000 \
    ${APP_NAME}:${VERSION}
  
  # Clean up
  rm /tmp/${APP_NAME}-${VERSION}.tar.gz
  
  echo "✅ Deployment complete!"
  docker ps | grep ${APP_NAME}
EOF

# Clean up local tarball
rm ${APP_NAME}-${VERSION}.tar.gz

echo "🎉 Deployment finished!"
echo "📊 Check logs with: ssh ${DROPLET_USER}@${DROPLET_IP} 'docker logs -f ${APP_NAME}'"
