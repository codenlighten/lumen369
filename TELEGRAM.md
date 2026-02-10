# Telegram Bot Setup

## Configuration

### 1. Get Your Telegram Chat ID

To get your Telegram Chat ID:

1. Start a chat with [@userinfobot](https://t.me/userinfobot)
2. Send any message
3. Copy your Chat ID (numeric value)
4. Add it to `.env` as `TELEGRAM_ADMIN_ID`

### 2. Environment Variables

Add to `.env`:

```bash
TELEGRAM_BOT_TOKEN=8576376687:AAG9dUf3fmTdW1LKMpFX86Cj5NrdoK3ASEY
TELEGRAM_ADMIN_ID=YOUR_CHAT_ID
```

## Running the Bot

### Local Development

```bash
npm run telegram
```

### Docker

```bash
# Build and run with docker-compose
docker-compose up -d

# Or manually
docker run -d \
  --name lumen-coder \
  --env-file .env \
  -v $(pwd)/memory.json:/app/memory.json \
  -v $(pwd)/audit.log:/app/audit.log \
  lumen-coder:latest
```

### On Droplet

```bash
# Deploy using deploy script
./deploy.sh v1.1.0

# Or manually on the droplet
ssh root@159.89.130.149

# Update .env on droplet
cat > /opt/lumen-coder/.env << EOF
OPENAI_API_KEY=your_key_here
TELEGRAM_BOT_TOKEN=8576376687:AAG9dUf3fmTdW1LKMpFX86Cj5NrdoK3ASEY
TELEGRAM_ADMIN_ID=YOUR_CHAT_ID
EOF

# Restart container
docker restart lumen-coder
```

## Bot Commands

- `/start` - Welcome message and help
- `/stats` - View memory statistics  
- `/autoapprove` - Toggle auto-approval of terminal commands
- `/clear` - Clear conversation memory (admin only)

## Features

### Agent Chain Processing

The bot uses the same agent chain as `chat.js`:

1. **Base Agent** - Determines response type (response/code/terminalCommand)
2. **Tool Check** - If specialized tool needed, routes to schema choice
3. **Schema Choice** - Selects appropriate tool (filetree/summarize)
4. **Tool Execution** - Runs specialized tool
5. **Post-Tool Processing** - Base agent processes tool results

### Memory System

- Same rolling window system (21 interactions + 3 summaries)
- Persists to `memory.json`
- Each chat message is stored with full context
- Terminal execution results included in memory

### Terminal Commands

- Commands can be executed directly
- Auto-approve mode available (toggle with `/autoapprove`)
- Dangerous patterns detected and flagged
- All executions logged to `audit.log`
- Output sent back to Telegram (truncated to 3000 chars)

### Code Generation

- Syntax-highlighted code blocks
- Explanation provided with code
- Multiple languages supported

## Security

### Admin-Only Commands

`/clear` command only works for the admin chat ID specified in `TELEGRAM_ADMIN_ID`.

### Command Approval

By default, dangerous commands require approval. Use `/autoapprove` to toggle automatic execution.

Dangerous patterns detected:
- `rm -rf`
- `sudo rm`
- `mkfs`
- `dd if=/dev`
- `chmod 777`
- `curl | bash`
- And more...

### Environment Variables

Never commit `.env` to git. The bot token and API keys should be kept secret.

## Troubleshooting

### Bot not responding

```bash
# Check container logs
docker logs lumen-coder

# Check bot is running
docker exec lumen-coder ps aux | grep telegram
```

### Token errors

Verify `TELEGRAM_BOT_TOKEN` is correct in `.env` and passed to Docker:

```bash
docker exec lumen-coder env | grep TELEGRAM
```

### Memory not persisting

Ensure volume mounts are correct:

```bash
docker inspect lumen-coder | grep -A 10 Mounts
```

## Development

### Testing locally

```bash
# Install dependencies
npm install

# Run bot
npm run telegram

# Send test message from Telegram
# Bot should respond
```

### Adding new commands

Edit `telegram-bot.js` and add new command handlers:

```javascript
bot.onText(/\/mycommand/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Response');
});
```

### Formatting responses

Telegram supports Markdown:

```javascript
await bot.sendMessage(chatId, 
  '*Bold text*\n' +
  '_Italic text_\n' +
  '`Code block`\n' +
  '```language\nCode\n```',
  { parse_mode: 'Markdown' }
);
```

## Architecture

```
User Message (Telegram)
  ↓
telegram-bot.js
  ↓
processMessage()
  ↓
executeBaseAgent()
  ├→ Response → Send to Telegram
  ├→ Code → Format & send
  └→ Terminal Command → Execute & send result
      ↓
  (if tool needed)
      ↓
  executeSchemaChoiceAgent()
      ↓
  executeSpecializedTool()
      ↓
  executeBaseAgent() (post-tool)
      ↓
  Format & send to Telegram
```

All interactions flow through the same memory system as `chat.js`.
