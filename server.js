/**
 * Web Server for Lumen Coder
 * 
 * Provides HTTP + WebSocket interface to the same agent chain
 * used by chat.js and telegram-bot.js
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const PORT = process.env.WEB_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'lumen-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

/**
 * Execute the base agent
 */
async function executeBaseAgent(userQuery, memoryContext, sessionId, redactor = null) {
  const request = {
    query: userQuery,
    context: memoryContext,
    sessionId
  };
  
  // Add secret redaction context if available
  let enhancedContext = memoryContext;
  if (redactor && redactor.hasSecrets()) {
    const secretContext = buildPlaceholderContext(redactor);
    enhancedContext = memoryContext ? `${memoryContext}\n\n${secretContext}` : secretContext;
  }
  
  const response = await queryOpenAI(userQuery, {
    schema: baseAgentExtendedResponseSchema,
    context: enhancedContext
  });
  
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
async function executeSchemaChoiceAgent(userQuery, memoryContext, sessionId) {
  const toolsList = Object.values(AVAILABLE_TOOLS)
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');
  
  const enhancedQuery = `Based on the user's need, which specialized tool should be used?\n\nAvailable tools:\n${toolsList}\n\nUser query: ${userQuery}`;
  
  const request = {
    query: enhancedQuery,
    context: memoryContext,
    availableTools: Object.keys(AVAILABLE_TOOLS),
    sessionId
  };
  
  const response = await queryOpenAI(enhancedQuery, {
    schema: schemaChoiceAgentResponseSchema,
    context: memoryContext
  });
  
  await addInteraction(request, response);
  return response;
}

/**
 * Execute a specialized tool
 */
async function executeSpecializedTool(toolName, userQuery, memoryContext, sessionId) {
  const tool = AVAILABLE_TOOLS[toolName];
  
  if (!tool) {
    return null;
  }
  
  const request = {
    query: userQuery,
    context: memoryContext,
    tool: toolName,
    sessionId
  };
  
  const response = await queryOpenAI(userQuery, {
    schema: tool.schema,
    context: memoryContext
  });
  
  await addInteraction(request, response);
  return response;
}

/**
 * Process user message through agent chain
 */
async function processMessage(userQuery, ws, sessionId, autoApprove = false) {
  try {
    // Create secret redactor for this session
    const redactor = new SecretRedactor();
    
    // Redact secrets from user query
    const redactedQuery = redactor.redact(userQuery);
    
    // Log redaction if secrets were found
    if (redactor.hasSecrets()) {
      const report = redactor.getReport();
      console.log(`🔒 [${sessionId}] Protected ${report.secretsProtected} secret(s)`);
      ws.send(JSON.stringify({ 
        type: 'status', 
        message: `🔒 ${report.secretsProtected} secret(s) protected` 
      }));
    }
    
    let continueLoop = true;
    let iteration = 0;
    const maxIterations = 5;
    
    while (continueLoop && iteration < maxIterations) {
      iteration++;
      
      const memoryContext = await getMemoryContextString();
      
      // Step 1: Base Agent
      ws.send(JSON.stringify({ type: 'status', message: 'Processing...' }));
      const baseResponse = await executeBaseAgent(redactedQuery, memoryContext, sessionId, redactor);
      
      // Send base response
      ws.send(JSON.stringify({ 
        type: 'response', 
        data: baseResponse,
        iteration 
      }));
      
      // Handle terminal commands
      if (baseResponse.choice === 'terminalCommand') {
        // Substitute secrets back into the command
        const finalCommand = redactor.substitute(baseResponse.terminalCommand);
        
        if (baseResponse.requiresApproval && !autoApprove) {
          ws.send(JSON.stringify({ 
            type: 'approval', 
            command: finalCommand,
            reasoning: baseResponse.commandReasoning 
          }));
          // Wait for user approval (handled by client)
          return;
        } else {
          ws.send(JSON.stringify({ type: 'status', message: 'Executing command...' }));
          
          const executionResult = await executeAgentCommand({
            command: finalCommand,
            commandReasoning: baseResponse.commandReasoning,
            requiresApproval: baseResponse.requiresApproval
          }, {
            autoApprove: true,
            timeout: 30000
          });
          
          await addInteraction(
            { query: 'Terminal execution', command: baseResponse.terminalCommand, sessionId },
            {
              status: executionResult.status,
              stdout: executionResult.stdout || '',
              stderr: executionResult.stderr || '',
              exitCode: executionResult.exitCode
            }
          );
          
          ws.send(JSON.stringify({ 
            type: 'execution', 
            result: executionResult 
          }));
          
          continueLoop = true;
        }
      }
      
      // Step 2: Tool choice if needed
      if (baseResponse.tool) {
        ws.send(JSON.stringify({ type: 'status', message: 'Selecting tool...' }));
        
        const updatedMemoryContext = await getMemoryContextString();
        const choiceResponse = await executeSchemaChoiceAgent(redactedQuery, updatedMemoryContext, sessionId);
        
        if (choiceResponse.choice && AVAILABLE_TOOLS[choiceResponse.choice]) {
          ws.send(JSON.stringify({ 
            type: 'status', 
            message: `Using ${choiceResponse.choice} tool...` 
          }));
          
          const finalMemoryContext = await getMemoryContextString();
          const toolResponse = await executeSpecializedTool(
            choiceResponse.choice,
            userQuery,
            finalMemoryContext,
            sessionId
          );
          
          if (toolResponse) {
            ws.send(JSON.stringify({ 
              type: 'tool-response', 
              tool: choiceResponse.choice,
              data: toolResponse 
            }));
          }
          
          // Run base agent post-tool
          const postToolMemoryContext = await getMemoryContextString();
          const postToolResponse = await executeBaseAgent(
            'Process and respond based on the tool execution results',
            postToolMemoryContext,
            sessionId
          );
          
          ws.send(JSON.stringify({ 
            type: 'response', 
            data: postToolResponse,
            postTool: true 
          }));
          
          continueLoop = postToolResponse.continue;
        }
      } else if (baseResponse.continue) {
        continueLoop = true;
        // Keep using redacted query for continuations
      } else {
        continueLoop = false;
      }
      
      if (iteration >= maxIterations) {
        ws.send(JSON.stringify({ 
          type: 'warning', 
          message: 'Max iterations reached' 
        }));
      }
    }
    
    ws.send(JSON.stringify({ type: 'complete' }));
    
  } catch (error) {
    console.error('Error processing message:', error);
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: error.message 
    }));
  }
}

// Authentication endpoint
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { admin: true, timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Memory stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getMemoryStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');
  
  let authenticated = false;
  let sessionId = null;
  let autoApprove = false;
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      // Authenticate
      if (message.type === 'auth') {
        try {
          const decoded = jwt.verify(message.token, JWT_SECRET);
          authenticated = true;
          sessionId = `web-${Date.now()}`;
          ws.send(JSON.stringify({ 
            type: 'auth-success', 
            sessionId 
          }));
          console.log(`✅ WebSocket authenticated: ${sessionId}`);
        } catch (error) {
          ws.send(JSON.stringify({ 
            type: 'auth-failed', 
            message: 'Invalid token' 
          }));
          ws.close();
        }
        return;
      }
      
      if (!authenticated) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Not authenticated' 
        }));
        return;
      }
      
      // Handle messages
      if (message.type === 'message') {
        console.log(`[${sessionId}] ${message.text}`);
        await processMessage(message.text, ws, sessionId, autoApprove);
      } else if (message.type === 'set-auto-approve') {
        autoApprove = message.value;
        ws.send(JSON.stringify({ 
          type: 'config', 
          autoApprove 
        }));
      } else if (message.type === 'approve-command') {
        // Execute approved command
        // (Would need to store pending command state)
      }
      
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 WebSocket closed: ${sessionId || 'unauthenticated'}`);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Lumen Web Server started on port ${PORT}`);
  console.log(`📊 HTTP: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`🔐 Admin password: ${ADMIN_PASSWORD === 'admin123' ? '⚠️  CHANGE DEFAULT PASSWORD!' : '✅ Custom password set'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
