/**
 * Chat Interface with Memory System and Agent Chain
 * 
 * Flow: base → choice → tool → base → choice → tool
 * - baseAgent: Initial response, decides if tool is needed
 * - schemaChoiceAgent: If tool=true, chooses which specialized tool
 * - Specialized tool: Executes the chosen tool (filetree, summarize, etc.)
 * - Loop continues with memory context
 */

import readline from 'readline';
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

// Global config for terminal execution
let autoApproveCommands = false;

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
async function executeBaseAgent(userQuery, memoryContext) {
  const request = {
    query: userQuery,
    context: memoryContext
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
async function executeSchemaChoiceAgent(userQuery, memoryContext) {
  const toolsList = Object.values(AVAILABLE_TOOLS)
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');
  
  const enhancedQuery = `Based on the user's need, which specialized tool should be used?\n\nAvailable tools:\n${toolsList}\n\nUser query: ${userQuery}`;
  
  const request = {
    query: enhancedQuery,
    context: memoryContext,
    availableTools: Object.keys(AVAILABLE_TOOLS)
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
async function executeSpecializedTool(toolName, userQuery, memoryContext) {
  const tool = AVAILABLE_TOOLS[toolName];
  
  if (!tool) {
    console.log(`⚠️  Tool '${toolName}' not found, skipping...`);
    return null;
  }
  
  const request = {
    query: userQuery,
    context: memoryContext,
    tool: toolName
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
 * Main conversation loop
 */
async function processUserInput(userQuery) {
  console.log('\n' + '═'.repeat(60));
  console.log('🔄 Processing:', userQuery);
  console.log('═'.repeat(60));
  
  let continueLoop = true;
  let iteration = 0;
  const maxIterations = 5; // Safety limit
  
  while (continueLoop && iteration < maxIterations) {
    iteration++;
    console.log(`\n📍 Iteration ${iteration}`);
    
    // Get current memory context
    const memoryContext = await getMemoryContextString();
    
    // Step 1: Base Agent
    console.log('\n🤖 Base Agent...');
    const baseResponse = await executeBaseAgent(userQuery, memoryContext);
    
    console.log('├─ Choice:', baseResponse.choice);
    console.log('├─ Tool needed:', baseResponse.tool);
    console.log('├─ Continue:', baseResponse.continue);
    
    // Display base agent response
    if (baseResponse.choice === 'response') {
      console.log('└─ Response:', baseResponse.response);
    } else if (baseResponse.choice === 'code') {
      console.log('└─ Code:', baseResponse.language);
      console.log('   ', baseResponse.code.substring(0, 100) + '...');
    } else if (baseResponse.choice === 'terminalCommand') {
      console.log('└─ Command:', baseResponse.terminalCommand);
      console.log('   Reasoning:', baseResponse.commandReasoning);
      
      // Execute the terminal command
      console.log('\n⚙️  Executing terminal command...');
      const executionResult = await executeAgentCommand({
        command: baseResponse.terminalCommand,
        commandReasoning: baseResponse.commandReasoning,
        requiresApproval: baseResponse.requiresApproval
      }, {
        autoApprove: autoApproveCommands,
        timeout: 30000
      });
      
      // Store full execution result in memory with command and output
      await addInteraction(
        { 
          query: 'Terminal command execution',
          command: baseResponse.terminalCommand,
          reasoning: baseResponse.commandReasoning
        },
        {
          status: executionResult.status,
          command: executionResult.command,
          stdout: executionResult.stdout || '',
          stderr: executionResult.stderr || '',
          exitCode: executionResult.exitCode,
          message: executionResult.message,
          executionTimeMs: executionResult.executionTimeMs
        }
      );
      
      // Display execution result
      if (executionResult.status === 'success') {
        console.log('✅ Command executed successfully');
        if (executionResult.stdout) {
          console.log('\n📤 Output:');
          console.log(executionResult.stdout);
        }
        if (executionResult.stderr) {
          console.log('\n⚠️  Stderr:');
          console.log(executionResult.stderr);
        }
      } else if (executionResult.status === 'denied') {
        console.log('❌ Command execution denied by user');
      } else if (executionResult.status === 'blocked') {
        console.log('🚫 Command blocked for safety:', executionResult.message);
      } else if (executionResult.status === 'error') {
        console.log('❌ Command execution failed:', executionResult.message);
        if (executionResult.stderr) {
          console.log('   Error output:', executionResult.stderr);
        }
      }
      
      // Force continue to allow agent to process the execution result
      if (executionResult.status === 'success' || executionResult.status === 'error') {
        console.log('\n📋 Agent will process execution result...');
        continueLoop = true;
      }
    }
    
    // Step 2: If tool is needed, use schema choice agent
    if (baseResponse.tool) {
      console.log('\n🔧 Schema Choice Agent...');
      const updatedMemoryContext = await getMemoryContextString();
      const choiceResponse = await executeSchemaChoiceAgent(userQuery, updatedMemoryContext);
      
      console.log('├─ Choice:', choiceResponse.choice);
      console.log('└─ Reasoning:', choiceResponse.reasoning.substring(0, 100) + '...');
      
      // Step 3: Execute the chosen specialized tool
      if (choiceResponse.choice && AVAILABLE_TOOLS[choiceResponse.choice]) {
        console.log(`\n🛠️  Executing ${choiceResponse.choice} tool...`);
        const finalMemoryContext = await getMemoryContextString();
        const toolResponse = await executeSpecializedTool(
          choiceResponse.choice,
          userQuery,
          finalMemoryContext
        );
        
        if (toolResponse) {
          console.log('└─ Tool executed successfully');
          
          // Display tool-specific output
          if (toolResponse.fileTree) {
            console.log('\n📁 File Tree Generated:');
            console.log(toolResponse.fileTree.substring(0, 200) + '...');
          } else if (toolResponse.summary) {
            console.log('\n📄 Summary Generated:');
            console.log(toolResponse.summary.substring(0, 200) + '...');
          }
        }
      }
      
      // After tool execution, run base agent one more time
      console.log('\n🤖 Base Agent (post-tool)...');
      const postToolMemoryContext = await getMemoryContextString();
      const postToolResponse = await executeBaseAgent(
        'Process and respond based on the tool execution results in context',
        postToolMemoryContext
      );
      
      console.log('├─ Choice:', postToolResponse.choice);
      
      // Display post-tool response
      if (postToolResponse.choice === 'response') {
        console.log('└─ Response:', postToolResponse.response);
      } else if (postToolResponse.choice === 'code') {
        console.log('└─ Code Generated:', postToolResponse.language);
        console.log('   ', postToolResponse.code.substring(0, 150) + '...');
      } else if (postToolResponse.choice === 'terminalCommand') {
        console.log('└─ New Command:', postToolResponse.terminalCommand);
      }
      
      // Check if we need to continue after post-tool base agent
      continueLoop = postToolResponse.continue;
    } else if (baseResponse.continue) {
      // Continue is true but tool is false - base agent wants to do more work
      console.log('\n↻ Base agent continuing (no tool needed)...');
      continueLoop = true;
    } else {
      // Both tool and continue are false - we're done (unless we just executed a terminal command)
      continueLoop = false;
    }
    
    if (continueLoop) {
      console.log('\n↻ Continuing to next iteration...');
      // For next iteration, provide context about what just happened
      userQuery = `Continue processing. Review the context from previous interactions and respond accordingly.`;
    } else {
      console.log('\n✅ Base agent has completed the response');
    }
  }
  
  if (iteration >= maxIterations) {
    console.log('\n⚠️  Max iterations reached');
  }
  
  console.log('\n✓ Processing complete\n');
}

/**
 * Start the chat interface
 */
async function startChat() {
  console.log('\n' + '═'.repeat(60));
  console.log('💬 Lumen Chat Interface');
  console.log('Using: Memory System + Base Agent + Schema Choice Agent');
  console.log('═'.repeat(60));
  
  // Show memory stats
  const stats = await getMemoryStats();
  console.log('\n📊 Memory Stats:');
  console.log('├─ Total interactions:', stats.totalInteractionsProcessed);
  console.log('├─ Current stored:', stats.currentInteractionsStored);
  console.log('└─ Summaries:', stats.summariesStored);
  
  console.log('\n💡 Type your message and press Enter');
  console.log('💡 Type "exit" to quit, "stats" for memory stats');
  console.log('💡 Type "autoapprove on/off" to toggle auto-approval of commands');
  console.log('═'.repeat(60) + '\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '👤 You: '
  });
  
  rl.prompt();
  
  rl.on('line', async (input) => {
    const userInput = input.trim();
    
    if (!userInput) {
      rl.prompt();
      return;
    }
    
    if (userInput.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!\n');
      rl.close();
      process.exit(0);
    }
    
    if (userInput.toLowerCase() === 'stats') {
      const currentStats = await getMemoryStats();
      console.log('\n📊 Current Memory Stats:');
      console.log('├─ Total interactions:', currentStats.totalInteractionsProcessed);
      console.log('├─ Current stored:', currentStats.currentInteractionsStored);
      console.log('├─ Summaries:', currentStats.summariesStored);
      console.log('├─ Oldest:', currentStats.oldestInteraction);
      console.log('└─ Newest:', currentStats.newestInteraction);
      console.log('');
      rl.prompt();
      return;
    }
    
    if (userInput.toLowerCase().startsWith('autoapprove')) {
      const parts = userInput.toLowerCase().split(' ');
      if (parts[1] === 'on') {
        autoApproveCommands = true;
        console.log('\n✅ Auto-approval ENABLED - Commands will execute automatically\n');
      } else if (parts[1] === 'off') {
        autoApproveCommands = false;
        console.log('\n⚠️  Auto-approval DISABLED - Commands will require manual approval\n');
      } else {
        console.log('\n📋 Auto-approval status:', autoApproveCommands ? 'ENABLED' : 'DISABLED');
        console.log('   Usage: autoapprove on|off\n');
      }
      rl.prompt();
      return;
    }
    
    try {
      await processUserInput(userInput);
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error.stack);
    }
    
    rl.prompt();
  });
  
  rl.on('close', () => {
    console.log('\n👋 Goodbye!\n');
    process.exit(0);
  });
}

// Start the chat
startChat().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
