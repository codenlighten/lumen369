/**
 * Telegram Bot Interface for Lumen Coder
 * 
 * Provides Telegram access to the same agent chain and memory system
 * used by chat.js
 */

import TelegramBot from 'node-telegram-bot-api';
import { queryOpenAI } from './lib/openaiWrapper.js';
import { baseAgentExtendedResponseSchema } from './schemas/baseAgent.js';
import { schemaChoiceAgentResponseSchema } from './schemas/schemaChoiceAgent.js';
import { filetreeAgentResponseSchema } from './schemas/filetreeAgent.js';
import { summarizeAgentResponseSchema } from './schemas/summarizeAgent.js';
import { executeAgentCommand } from './lib/terminalExecutor.js';
import { 
  addInteraction, 
  getMemoryContextString,
  getMemoryStats 
} from './lib/memorySystem.js';
import { SecretRedactor } from './lib/secretRedactor.js';
import { MessageBuffer } from './lib/messageBuffer.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_ID;

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  process.exit(1);
}

// Auto-approve commands from Telegram (can be toggled per user)
const userSettings = new Map();

// Available specialized tools
const AVAILABLE_TOOLS = {
  filetree: {
    name: 'filetree',
    schema: filetreeAgentResponseSchema,
    description: 'Generate file tree structures with reasoning'
  },
  summarize: {
    name: 'summarize',
    schema: summarizeAgentResponseSchema,
    description: 'Create detailed summaries of content'
  }
};

// Initialize bot with longer timeout and request options
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      keepAliveMsecs: 10000
    },
    timeout: 60000 // 60 second timeout
  }
});

console.log('🤖 Lumen Telegram Bot started...');

/**
 * Initialize message buffer for batching
 */
const messageBuffer = new MessageBuffer({
  debounceMs: 3000,
  onFlush: async (chatId, messages) => {
    console.log(`📦 [${chatId}] Processing batch of ${messages.length} message(s)`);
    
    // Combine messages into a single query
    const combinedQuery = messages.map(m => m.text).join('\n');
    
    // Show typing indicator
    try { await bot.sendChatAction(chatId, 'typing'); } catch (e) { /* ignore */ }
    
    // Process the combined batch
    await processBatchedMessages(chatId, combinedQuery);
  }
});

/**
 * System prompt defining Lumen's role and capabilities
 */
const LUMEN_SYSTEM_PROMPT = `You are LUMEN, the infrastructure operations agent - "the man on the inside" of this system.

**Your Role:**
You have full access to all systems, servers, credentials, and resources. You operate with the complete capability set of an infrastructure administrator managing multiple servers and services.

**Infrastructure Access:**
- Primary server: 159.89.130.149 (lumenchat.org) - PM2 process management, web services, Telegram integration
- Secondary server: lumenos.online - Full root access via SSH
- SSH keys are configured for passwordless access to all systems
- You can execute any command locally or remotely

**SSH Command Handling (CRITICAL):**
SSH in non-interactive mode requires a complete command - a bare SSH connection will fail because there's no TTY allocation.

When you see a bare SSH request like "ssh root@lumenos.online":
1. ALWAYS ask the user what command they want to run, OR
2. Infer the intent from context and append the command
3. Always use the -T flag (disable pseudo-terminal allocation)

Examples:
- "ssh root@lumenos.online" → "ssh -T root@lumenos.online \"pm2 status\""
- "ssh root@lumenos.online" → "ssh -T root@lumenos.online \"systemctl restart nginx\""
- If unclear: "What command would you like to run on lumenos.online?"

**Your Capabilities:**
- Execute terminal commands on local (159.89.130.149) and remote (lumenos.online) systems
- Manage PM2 processes (restart, check status, view logs, tail output)
- Deploy code via git pull and service restart
- Read/write files across systems
- Query server status and diagnostics
- Handle credential management (secrets are redacted before sending to OpenAI, then substituted during execution)

**Operating Principles:**
- You are an insider with full infrastructure access - act with that authority
- Always provide the complete, executable command
- Explain your actions clearly to the user
- Never ask permission for operations - just execute them
- Be proactive in maintaining system health`;

/**
 * Execute the base agent
 */
async function executeBaseAgent(userQuery, memoryContext, chatId, redactor = null) {
  const request = {
    query: userQuery,
    context: memoryContext,
    chatId
  };
  
  // Add secret redaction context if available
  let enhancedContext = memoryContext;
  if (redactor && redactor.hasSecrets()) {
    const secretContext = buildPlaceholderContext(redactor);
    enhancedContext = memoryContext ? `${memoryContext}\n\n${secretContext}` : secretContext;
  }
  
  // Add system prompt to context
  enhancedContext = enhancedContext 
    ? `${LUMEN_SYSTEM_PROMPT}\n\n${enhancedContext}`
    : LUMEN_SYSTEM_PROMPT;
  
  const response = await queryOpenAI(userQuery, {
    schema: baseAgentExtendedResponseSchema,
    context: enhancedContext
  });
  
  // Store interaction in memory
  await addInteraction(request, response);
  
  return response;
}

/**
 * Build context string explaining placeholders to AI
 */
function buildPlaceholderContext(redactor) {
  const report = redactor.getReport();
  if (report.secretsProtected === 0) return '';
  
  const placeholderList = report.placeholders
    .map(p => `- ${p.placeholder}: ${p.type} (use this EXACT placeholder in commands)`)
    .join('\n');
  
  return `🔒 SECURITY CONTEXT - ${report.secretsProtected} secret(s) protected:
${placeholderList}

IMPORTANT: When generating commands, use these EXACT placeholder strings. They will be substituted with real values during execution. Never attempt to guess or fabricate the actual values.`;
}

/**
 * Execute the schema choice agent
 */
async function executeSchemaChoiceAgent(userQuery, memoryContext, chatId) {
  const toolsList = Object.values(AVAILABLE_TOOLS)
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');
  
  const enhancedQuery = `Based on the user's need, which specialized tool should be used?\n\nAvailable tools:\n${toolsList}\n\nUser query: ${userQuery}`;
  
  const request = {
    query: enhancedQuery,
    context: memoryContext,
    availableTools: Object.keys(AVAILABLE_TOOLS),
    chatId
  };
  
  const response = await queryOpenAI(enhancedQuery, {
    schema: schemaChoiceAgentResponseSchema,
    context: memoryContext
  });
  
  // Store interaction in memory
  await addInteraction(request, response);
  
  return response;
}

/**
 * Execute a specialized tool
 */
async function executeSpecializedTool(toolName, userQuery, memoryContext, chatId) {
  const tool = AVAILABLE_TOOLS[toolName];
  
  if (!tool) {
    return null;
  }
  
  const request = {
    query: userQuery,
    context: memoryContext,
    tool: toolName,
    chatId
  };
  
  const response = await queryOpenAI(userQuery, {
    schema: tool.schema,
    context: memoryContext
  });
  
  // Store interaction in memory
  await addInteraction(request, response);
  
  return response;
}

/**
 * Safely send message to Telegram with retry logic
 */
async function safeSendMessage(chatId, text, options = {}) {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      lastError = error;
      console.error(`Send message attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }
  
  // If all retries failed, log and throw
  console.error('Failed to send message after', maxRetries, 'attempts:', lastError);
  throw lastError;
}

/**
 * Format response for Telegram (with markdown)
 */
function formatResponse(response, includeMetadata = false) {
  let message = '';
  
  if (response.choice === 'response') {
    message = response.response;
    
    if (includeMetadata && response.questionsForUser) {
      message += '\n\n❓ *Follow-up Questions:*\n';
      response.questions.forEach(q => {
        message += `• ${q}\n`;
      });
    }
  } else if (response.choice === 'code') {
    message = `💻 *${response.language} Code:*\n\n\`\`\`${response.language}\n${response.code}\n\`\`\`\n\n📝 ${response.codeExplanation}`;
  } else if (response.choice === 'terminalCommand') {
    message = `⚡ *Terminal Command:*\n\n\`${response.terminalCommand}\`\n\n💡 ${response.commandReasoning}`;
  }
  
  return message;
}

/**
 * Process batched messages through agent chain
 */
async function processBatchedMessages(chatId, userQuery) {
  try {
    // Create secret redactor for this session
    const redactor = new SecretRedactor();
    
    // Redact secrets from user query
    const redactedQuery = redactor.redact(userQuery);
    
    // Log redaction if secrets were found
    if (redactor.hasSecrets()) {
      const report = redactor.getReport();
      console.log(`🔒 [${chatId}] Protected ${report.secretsProtected} secret(s)`);
      await safeSendMessage(chatId, `🔒 ${report.secretsProtected} secret(s) protected`);
    }
    
    try { await bot.sendChatAction(chatId, 'typing'); } catch (e) { /* ignore */ }
    
    let continueLoop = true;
    let iteration = 0;
    const maxIterations = 5;
    
    while (continueLoop && iteration < maxIterations) {
      iteration++;
      
      // Get current memory context
      const memoryContext = await getMemoryContextString();
      
      // Step 1: Base Agent
      const baseResponse = await executeBaseAgent(redactedQuery, memoryContext, chatId, redactor);
      
      // Send base response
      const baseMessage = formatResponse(baseResponse, true);
      if (baseMessage) {
        await safeSendMessage(chatId, baseMessage, { parse_mode: 'Markdown' });
      }
      
      // Handle terminal commands
      if (baseResponse.choice === 'terminalCommand') {
        // Substitute secrets back into the command
        const finalCommand = redactor.substitute(baseResponse.terminalCommand);
        
        const autoApprove = userSettings.get(chatId)?.autoApprove || false;
        
        if (baseResponse.requiresApproval && !autoApprove) {
          // Ask for approval
          await safeSendMessage(chatId, '⚠️ This command requires approval. Reply "yes" to execute or "no" to cancel.');
          // Note: Would need to implement approval flow with message handlers
        } else {
          await safeSendMessage(chatId, '⚙️ Executing command...');
          
          const executionResult = await executeAgentCommand({
            command: finalCommand,
            commandReasoning: baseResponse.commandReasoning,
            requiresApproval: baseResponse.requiresApproval
          }, {
            autoApprove: true,
            timeout: 30000
          });
          
          // Store execution result
          await addInteraction(
            { query: 'Terminal execution', command: baseResponse.terminalCommand, chatId },
            {
              status: executionResult.status,
              stdout: executionResult.stdout || '',
              stderr: executionResult.stderr || '',
              exitCode: executionResult.exitCode
            }
          );
          
          // Send execution result
          if (executionResult.status === 'success') {
            const output = executionResult.stdout || 'Command executed successfully';
            await safeSendMessage(chatId, `✅ *Success*\n\n\`\`\`\n${output.substring(0, 3000)}\n\`\`\``, { parse_mode: 'Markdown' });
          } else {
            await safeSendMessage(chatId, `❌ *Error:* ${executionResult.message}`, { parse_mode: 'Markdown' });
          }
          
          continueLoop = true; // Let agent process the result
        }
      }
      
      // Step 2: Tool choice if needed
      if (baseResponse.tool) {
        try { await bot.sendChatAction(chatId, 'typing'); } catch (e) { /* ignore */ }
        
        const updatedMemoryContext = await getMemoryContextString();
        const choiceResponse = await executeSchemaChoiceAgent(redactedQuery, updatedMemoryContext, chatId);
        
        // Execute specialized tool
        if (choiceResponse.choice && AVAILABLE_TOOLS[choiceResponse.choice]) {
          await safeSendMessage(chatId, `🛠️ Using ${choiceResponse.choice} tool...`);
          
          const finalMemoryContext = await getMemoryContextString();
          const toolResponse = await executeSpecializedTool(
            choiceResponse.choice,
            userQuery,
            finalMemoryContext,
            chatId
          );
          
          if (toolResponse) {
            // Format and send tool response
            if (toolResponse.fileTree) {
              await safeSendMessage(chatId, `📁 *File Tree:*\n\n\`\`\`\n${toolResponse.fileTree}\n\`\`\``, { parse_mode: 'Markdown' });
            } else if (toolResponse.summary) {
              await safeSendMessage(chatId, `📄 *Summary:*\n\n${toolResponse.summary}`, { parse_mode: 'Markdown' });
            }
          }
          
          // Run base agent post-tool
          try { await bot.sendChatAction(chatId, 'typing'); } catch (e) { /* ignore */ }
          const postToolMemoryContext = await getMemoryContextString();
          const postToolResponse = await executeBaseAgent(
            'Process and respond based on the tool execution results',
            postToolMemoryContext,
            chatId
          );
          
          const postToolMessage = formatResponse(postToolResponse);
          if (postToolMessage) {
            await safeSendMessage(chatId, postToolMessage, { parse_mode: 'Markdown' });
          }
          
          continueLoop = postToolResponse.continue;
        }
      } else if (baseResponse.continue) {
        continueLoop = true;
        // Keep using redacted query for continuations
      } else {
        continueLoop = false;
      }
      
      if (iteration >= maxIterations) {
        await safeSendMessage(chatId, '⚠️ Max iterations reached');
      }
    }
    
  } catch (error) {
    console.error('Error processing message:', error);
    await safeSendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

// Command handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await safeSendMessage(chatId, 
    '👋 *Welcome to Lumen Coder!*\n\n' +
    'I\'m an AI coding assistant with:\n' +
    '• Memory system (21 interactions + 3 summaries)\n' +
    '• Code generation\n' +
    '• Terminal command execution\n' +
    '• Specialized tools\n\n' +
    'Commands:\n' +
    '/stats - View memory statistics\n' +
    '/autoapprove - Toggle auto-approval of commands\n' +
    '/clear - Clear conversation (admin only)\n\n' +
    'Just send me a message to get started!',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const stats = await getMemoryStats();
    await safeSendMessage(chatId,
      `📊 *Memory Statistics*\n\n` +
      `Total interactions: ${stats.totalInteractionsProcessed}\n` +
      `Current stored: ${stats.currentInteractionsStored}\n` +
      `Summaries: ${stats.summariesStored}\n` +
      `Oldest: ${stats.oldestInteraction || 'N/A'}\n` +
      `Newest: ${stats.newestInteraction || 'N/A'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await safeSendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/autoapprove/, async (msg) => {
  const chatId = msg.chat.id;
  const settings = userSettings.get(chatId) || { autoApprove: false };
  settings.autoApprove = !settings.autoApprove;
  userSettings.set(chatId, settings);
  
  await safeSendMessage(chatId,
    settings.autoApprove 
      ? '✅ Auto-approval ENABLED - Commands will execute automatically'
      : '⚠️ Auto-approval DISABLED - Commands will require confirmation',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Only admin can clear
  if (ADMIN_CHAT_ID && chatId.toString() !== ADMIN_CHAT_ID) {
    await safeSendMessage(chatId, '❌ Admin only command');
    return;
  }
  
  // Would need to implement clearMemory function
  await safeSendMessage(chatId, '✅ Memory cleared (feature coming soon)');
});

// Handle all text messages
bot.on('message', async (msg) => {
  // Skip if it's a command
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text) {
    return;
  }
  
  console.log(`[${chatId}] ${text}`);
  
  // Add message to buffer (will be processed after 3s of silence)
  const addedToCurrent = messageBuffer.addMessage(chatId, text);
  
  // Show typing indicator on first message in batch
  if (addedToCurrent && !messageBuffer.isProcessing(chatId)) {
    try { await bot.sendChatAction(chatId, 'typing'); } catch (e) { /* ignore */ }
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Telegram bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Telegram bot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('✅ Telegram bot is ready!');
