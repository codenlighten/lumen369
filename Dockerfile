# Lumen Coder - Node.js Application
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create volume mount point for persistent memory
VOLUME ["/app/data"]

# Expose port for future web interface
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Keep container running - override CMD to run specific scripts
CMD ["tail", "-f", "/dev/null"]
