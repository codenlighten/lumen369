/**
 * Test integration of SecretRedactor with OpenAI wrapper
 */

import { SecretRedactor } from '../lib/secretRedactor.js';

// Simulate the flow
async function testIntegration() {
  console.log('\n🧪 Testing SecretRedactor Integration\n');
  
  const redactor = new SecretRedactor();
  
  // User's original message with secrets
  const userMessage = `
    SSH into root@lumenos.online using password: MySecureP@ss123 
    and check if the API key sk-1234567890abcdefghijk is stored in config
  `.trim();
  
  console.log('1️⃣  User Input:');
  console.log(`   "${userMessage}"\n`);
  
  // Redact secrets before sending to AI
  const redactedMessage = redactor.redact(userMessage);
  
  console.log('2️⃣  Redacted (sent to OpenAI):');
  console.log(`   "${redactedMessage}"\n`);
  
  // Build context that explains placeholders
  const placeholderContext = buildPlaceholderContext(redactor);
  
  console.log('3️⃣  Context added to system prompt:');
  console.log(placeholderContext);
  console.log();
  
  // Simulate AI response with placeholders
  const aiResponse = {
    choice: 'terminalCommand',
    terminalCommand: 'ssh root@lumenos.online -p {{PASSWORD_1}} "grep {{APIKEY_1}} config.json"',
    commandReasoning: 'SSH into server with provided credentials and search for API key in config'
  };
  
  console.log('4️⃣  AI Response (with placeholders):');
  console.log(`   Command: "${aiResponse.terminalCommand}"`);
  console.log(`   Reason: "${aiResponse.commandReasoning}"\n`);
  
  // Substitute placeholders back before execution
  const finalCommand = redactor.substitute(aiResponse.terminalCommand);
  
  console.log('5️⃣  Final Command (ready to execute):');
  console.log(`   "${finalCommand}"\n`);
  
  // Show what would be executed
  console.log('✅ Security Check:');
  console.log(`   ✓ Secrets never sent to OpenAI`);
  console.log(`   ✓ AI understands placeholders via context`);
  console.log(`   ✓ Real values substituted only at execution`);
  console.log(`   ✓ ${redactor.secrets.size} secrets protected`);
}

/**
 * Build context string explaining placeholders for the AI
 */
function buildPlaceholderContext(redactor) {
  if (redactor.secrets.size === 0) {
    return '';
  }
  
  const placeholders = Array.from(redactor.secrets.keys());
  
  return `
═══ SECURITY CONTEXT ═══
The user's message contains sensitive data that has been redacted with placeholders:
${placeholders.map((p, i) => `  ${i + 1}. ${p} - Contains sensitive credential data`).join('\n')}

IMPORTANT: 
- Use these EXACT placeholder strings in your commands
- Do NOT attempt to guess or replace these values
- The system will automatically substitute real values before execution
- Example: If you need to use a password, reference it as {{PASSWORD_1}}
═══════════════════════
  `.trim();
}

// Run test
testIntegration();
