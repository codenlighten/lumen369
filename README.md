# Lumen Coder

AI-powered coding assistant with memory system and intelligent agent chain.

## Features

- **Memory System**: Rolling window of 21 interactions + 3 summaries for context awareness
- **Base Agent**: Universal agent handling conversational responses, code generation, and terminal commands
- **Schema Choice Agent**: Intelligently selects specialized tools when needed
- **Specialized Tools**: File tree generation, summarization, and more
- **Terminal Execution**: Safe command execution with approval gates
- **Audit Logging**: Complete history of all commands and interactions

## Components

- `chat.js` - Interactive chat interface
- `lib/memorySystem.js` - Rolling memory manager with JSON persistence
- `lib/openaiWrapper.js` - OpenAI API integration with schema support
- `lib/terminalExecutor.js` - Safe terminal command execution
- `schemas/` - JSON schemas for different agent types

## Usage

```bash
npm install
node chat.js
```

## Commands

- Type any message to chat with Lumen
- `stats` - View memory statistics
- `autoapprove on/off` - Toggle auto-approval of terminal commands
- `exit` - Quit the chat

## Architecture

The system uses an agent chain flow:
1. Base Agent → Responds and decides if tool is needed
2. Schema Choice Agent → Selects specialized tool if needed
3. Specialized Tool → Executes chosen tool
4. Loop continues with full memory context

All interactions are stored in `memory.json` with temporal awareness.
