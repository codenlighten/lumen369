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

// Initialize bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('🤖 Lumen Telegram Bot started...');

/**
 * Execute the base agent
 */
async function executeBaseAgent(userQuery, memoryContext, chatId) {
  const request = {
    query: userQuery,
    context: memoryContext,
    chatId
  };
  
  const response = await queryOpenAI(userQuery, {
    schema: baseAgentExtendedResponseSchema,
    context: memoryContext
  });
  
  // Store interaction in memory
  await addInteraction(request, response);
  
  return response;
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
 * Process user message through agent chain
 */
async function processMessage(chatId, userQuery) {
  try {
    await bot.sendChatAction(chatId, 'typing');
    
    let continueLoop = true;
    let iteration = 0;
    const maxIterations = 5;
    
    while (continueLoop && iteration < maxIterations) {
      iteration++;
      
      // Get current memory context
      const memoryContext = await getMemoryContextString();
      
      // Step 1: Base Agent
      const baseResponse = await executeBaseAgent(userQuery, memoryContext, chatId);
      
      // Send base response
      const baseMessage = formatResponse(baseResponse, true);
      if (baseMessage) {
        await bot.sendMessage(chatId, baseMessage, { parse_mode: 'Markdown' });
      }
      
      // Handle terminal commands
      if (baseResponse.choice === 'terminalCommand') {
        const autoApprove = userSettings.get(chatId)?.autoApprove || false;
        
        if (baseResponse.requiresApproval && !autoApprove) {
          // Ask for approval
          await bot.sendMessage(chatId, '⚠️ This command requires approval. Reply "yes" to execute or "no" to cancel.');
          // Note: Would need to implement approval flow with message handlers
        } else {
          await bot.sendMessage(chatId, '⚙️ Executing command...');
          
          const executionResult = await executeAgentCommand({
            command: baseResponse.terminalCommand,
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
            await bot.sendMessage(chatId, `✅ *Success*\n\n\`\`\`\n${output.substring(0, 3000)}\n\`\`\``, { parse_mode: 'Markdown' });
          } else {
            await bot.sendMessage(chatId, `❌ *Error:* ${executionResult.message}`, { parse_mode: 'Markdown' });
          }
          
          continueLoop = true; // Let agent process the result
        }
      }
      
      // Step 2: Tool choice if needed
      if (baseResponse.tool) {
        await bot.sendChatAction(chatId, 'typing');
        
        const updatedMemoryContext = await getMemoryContextString();
        const choiceResponse = await executeSchemaChoiceAgent(userQuery, updatedMemoryContext, chatId);
        
        // Execute specialized tool
        if (choiceResponse.choice && AVAILABLE_TOOLS[choiceResponse.choice]) {
          await bot.sendMessage(chatId, `🛠️ Using ${choiceResponse.choice} tool...`);
          
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
              await bot.sendMessage(chatId, `📁 *File Tree:*\n\n\`\`\`\n${toolResponse.fileTree}\n\`\`\``, { parse_mode: 'Markdown' });
            } else if (toolResponse.summary) {
              await bot.sendMessage(chatId, `📄 *Summary:*\n\n${toolResponse.summary}`, { parse_mode: 'Markdown' });
            }
          }
          
          // Run base agent post-tool
          await bot.sendChatAction(chatId, 'typing');
          const postToolMemoryContext = await getMemoryContextString();
          const postToolResponse = await executeBaseAgent(
            'Process and respond based on the tool execution results',
            postToolMemoryContext,
            chatId
          );
          
          const postToolMessage = formatResponse(postToolResponse);
          if (postToolMessage) {
            await bot.sendMessage(chatId, postToolMessage, { parse_mode: 'Markdown' });
          }
          
          continueLoop = postToolResponse.continue;
        }
      } else if (baseResponse.continue) {
        continueLoop = true;
        userQuery = 'Continue processing based on previous context';
      } else {
        continueLoop = false;
      }
      
      if (iteration >= maxIterations) {
        await bot.sendMessage(chatId, '⚠️ Max iterations reached');
      }
    }
    
  } catch (error) {
    console.error('Error processing message:', error);
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

// Command handlers
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 
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
    await bot.sendMessage(chatId,
      `📊 *Memory Statistics*\n\n` +
      `Total interactions: ${stats.totalInteractionsProcessed}\n` +
      `Current stored: ${stats.currentInteractionsStored}\n` +
      `Summaries: ${stats.summariesStored}\n` +
      `Oldest: ${stats.oldestInteraction || 'N/A'}\n` +
      `Newest: ${stats.newestInteraction || 'N/A'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/autoapprove/, async (msg) => {
  const chatId = msg.chat.id;
  const settings = userSettings.get(chatId) || { autoApprove: false };
  settings.autoApprove = !settings.autoApprove;
  userSettings.set(chatId, settings);
  
  await bot.sendMessage(chatId,
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
    await bot.sendMessage(chatId, '❌ Admin only command');
    return;
  }
  
  // Would need to implement clearMemory function
  await bot.sendMessage(chatId, '✅ Memory cleared (feature coming soon)');
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
  await processMessage(chatId, text);
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
