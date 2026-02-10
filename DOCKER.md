# Docker Deployment Guide

## Local Development

### Build and Run Locally
```bash
# Using docker-compose (recommended)
docker-compose up -d

# Or build manually
docker build -t lumen-coder:latest .
docker run -it --rm \
  -e OPENAI_API_KEY=your_key_here \
  -v $(pwd)/memory.json:/app/memory.json \
  lumen-coder:latest
```

### Interactive Chat
```bash
# Attach to running container
docker exec -it lumen-coder node chat.js

# Or run directly
docker run -it --rm \
  -e OPENAI_API_KEY=your_key_here \
  lumen-coder:latest node chat.js
```

## Production Deployment

### Deploy to Droplet
```bash
# Make sure your .env file has OPENAI_API_KEY set
# Then run:
./deploy.sh v1.0.0

# Or deploy latest
./deploy.sh
```

### On Droplet

The container will be running at `/opt/lumen-coder`

**Check status:**
```bash
ssh root@159.89.130.149 'docker ps | grep lumen-coder'
```

**View logs:**
```bash
ssh root@159.89.130.149 'docker logs -f lumen-coder'
```

**Access interactive chat:**
```bash
ssh root@159.89.130.149
docker exec -it lumen-coder node chat.js
```

**Restart:**
```bash
ssh root@159.89.130.149 'docker restart lumen-coder'
```

## Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key

Optional:
- `OPENAI_DEFAULT_MODEL` - Default: gpt-4o-mini
- `OPENAI_DEFAULT_TEMPERATURE` - Default: 0.1

## Persistent Data

The following are persisted in volumes:
- `/app/memory.json` - Conversation memory (21 interactions + 3 summaries)
- `/app/audit.log` - Command execution audit trail
- `/app/data/` - Additional data storage

## Next Steps

After deployment, we'll add:
1. HTTP API endpoint for programmatic access
2. Telegram bot integration for remote chat
3. Web dashboard interface
