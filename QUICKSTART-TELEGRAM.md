# 🤖 Lumen Telegram Bot - Quick Start

## ✅ Bot is Live!

Your Telegram bot is now deployed and running on the droplet.

### Bot Information
- **Token**: `8576376687:AAG9dUf3fmTdW1LKMpFX86Cj5NrdoK3ASEY`
- **Status**: ✅ Running (healthy)
- **Location**: Droplet 159.89.130.149 (Docker container)
- **Version**: v1.1.0

## 📱 How to Use

### 1. Get Your Chat ID

To enable admin commands, you need your Telegram Chat ID:

1. Open Telegram and start a chat with [@userinfobot](https://t.me/userinfobot)
2. Send any message
3. Copy your Chat ID (numeric value like `123456789`)
4. Update `.env` on the droplet:

```bash
ssh root@159.89.130.149
nano /opt/lumen-coder/.env
# Add: TELEGRAM_ADMIN_ID=YOUR_CHAT_ID
docker restart lumen-coder
```

### 2. Find Your Bot

Search for your bot in Telegram using the bot token username. If you haven't set a username with [@BotFather](https://t.me/BotFather), you'll need to:

1. Start a chat with @BotFather
2. Send `/setusername`
3. Select your bot
4. Set a username (e.g., `lumen_coder_bot`)

### 3. Start Chatting

Once you find your bot:

1. Click "Start" or send `/start`
2. You'll see a welcome message with available commands
3. Just send any message to interact with the AI!

## 🎮 Commands

- `/start` - Welcome message and help
- `/stats` - View memory statistics (interactions, summaries, etc.)
- `/autoapprove` - Toggle auto-approval of terminal commands
- `/clear` - Clear conversation memory (admin only)

## 💬 What Can It Do?

### Regular Responses
```
You: What is Docker?
Bot: [Detailed explanation about Docker]
```

### Code Generation
```
You: Write a Python function to calculate fibonacci
Bot: 💻 Python Code:
[Code with syntax highlighting]
📝 [Explanation]
```

### Terminal Commands
```
You: List files in current directory
Bot: ⚡ Terminal Command:
ls -la
💡 [Reasoning]

⚙️ Executing command...
✅ Success
[Command output]
```

### Specialized Tools
The bot can use specialized tools like:
- **File Tree Generator** - Create project structures
- **Summarizer** - Summarize articles, code, documents

## 🔒 Security

### Auto-Approval
By default, dangerous commands require manual approval. Use `/autoapprove` to toggle:

- ✅ **Enabled**: Commands execute automatically
- ⚠️ **Disabled**: You confirm each command (safer)

### Dangerous Patterns Detected
- `rm -rf` - Recursive deletion
- `sudo rm` - Privileged deletion
- `mkfs` - Format filesystem
- `dd if=/dev` - Disk operations
- `chmod 777` - Insecure permissions
- `curl | bash` - Piped execution
- And more...

### Admin Commands
The `/clear` command only works for the admin chat ID specified in `TELEGRAM_ADMIN_ID`.

## 🧠 Memory System

The bot remembers your conversation:
- **21 interactions** stored
- **3 summaries** of older conversations
- Automatic summarization when memory is full
- Persists across restarts (saved to `memory.json`)

Use `/stats` to see current memory usage.

## 🐛 Troubleshooting

### Bot not responding?

```bash
# Check if container is running
ssh root@159.89.130.149 'docker ps | grep lumen-coder'

# Check logs
ssh root@159.89.130.149 'docker logs --tail 50 lumen-coder'

# Restart if needed
ssh root@159.89.130.149 'docker restart lumen-coder'
```

### 409 Conflict Error?

This means another bot instance is polling. Make sure:

```bash
# Check for telegram-listener service
ssh root@159.89.130.149 'systemctl status telegram-listener'

# Should show "disabled" - if not:
ssh root@159.89.130.149 'systemctl stop telegram-listener && systemctl disable telegram-listener'
```

### Commands not executing?

1. Check `/stats` to see if context is available
2. Make sure terminal executor is working:
   ```bash
   ssh root@159.89.130.149 'docker exec lumen-coder ls -la /app/lib'
   ```
3. Check audit log:
   ```bash
   ssh root@159.89.130.149 'cat /opt/lumen-coder/audit.log | tail -20'
   ```

## 📊 Monitoring

### Container Health
```bash
# Health check runs every 30s
docker ps --filter name=lumen-coder
# Look for "(healthy)" status
```

### Memory Usage
```bash
# Check memory.json size
ssh root@159.89.130.149 'ls -lh /opt/lumen-coder/memory.json'

# View memory contents
ssh root@159.89.130.149 'cat /opt/lumen-coder/memory.json | jq .'
```

### Audit Log
All terminal commands are logged:
```bash
ssh root@159.89.130.149 'tail -f /opt/lumen-coder/audit.log'
```

## 🚀 Next Steps

Now that your bot is running, you can:

1. **Set your admin Chat ID** to enable `/clear` command
2. **Set a bot username** with @BotFather for easy discovery
3. **Customize the welcome message** in `telegram-bot.js`
4. **Add new commands** by editing the bot code
5. **Create shortcuts** for common tasks

## 📚 Documentation

- [TELEGRAM.md](TELEGRAM.md) - Detailed Telegram setup guide
- [STATUS.md](STATUS.md) - Current project status
- [DOCKER.md](DOCKER.md) - Docker deployment details
- [MEMORY.md](MEMORY.md) - Memory system documentation
- [README.md](README.md) - Main project documentation

## 🎉 Success!

Your Telegram bot is now running and ready to assist you with:
- Answering questions
- Writing code
- Executing commands
- Using specialized tools
- Maintaining conversation context

Just open Telegram and start chatting! 🚀

---

**Need help?** Check the logs or documentation above.
**Want to extend?** Edit `telegram-bot.js` and redeploy with `./deploy.sh v1.x.x`
