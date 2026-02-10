import { queryOpenAI } from './lib/openaiWrapper.js';
import { schemaChoiceAgentResponseSchema } from './schemas/schemaChoiceAgent.js';

/**
 * Test file for openaiWrapper.js using schemaChoiceAgent.js schema
 * 
 * Tests the ability to intelligently choose between response types:
 * - response: conversational
 * - code: code generation
 * - terminalCommand: terminal execution
 */

console.log('═══════════════════════════════════════════════════════════');
console.log('Testing OpenAI Wrapper with Schema Choice Agent');
console.log('═══════════════════════════════════════════════════════════\n');

async function testQuestionNeedsResponse() {
  console.log('\n💬 TEST 1: Question Requiring Conversational Response');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "What is the difference between async and sync in JavaScript?";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User is asking a conceptual question about JavaScript"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
    throw error;
  }
}

async function testRequestNeedsCode() {
  console.log('\n💻 TEST 2: Request Requiring Code Generation');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Create a function to validate email addresses using regex.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User wants a specific code implementation"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
    throw error;
  }
}

async function testRequestNeedsTerminalCommand() {
  console.log('\n⚡ TEST 3: Request Requiring Terminal Command');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "I need to install Express in my Node.js project.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User wants to install a package"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
    throw error;
  }
}

async function testAmbiguousRequest() {
  console.log('\n❓ TEST 4: Ambiguous Request with Missing Context');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Set up the database.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User hasn't specified which database or how"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
    throw error;
  }
}

async function testComplexCodeRequest() {
  console.log('\n🔧 TEST 5: Complex Code Implementation Request');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Write a REST API endpoint that handles user authentication with JWT tokens.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User wants a specific implementation for their API"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 5 Failed:', error.message);
    throw error;
  }
}

async function testSystemAdministrationTask() {
  console.log('\n🖥️  TEST 6: System Administration Task');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Check the disk usage on the server and show me the largest files.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User wants to analyze disk usage on Linux system"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 6 Failed:', error.message);
    throw error;
  }
}

async function testExplanationRequest() {
  console.log('\n📚 TEST 7: Request for Explanation');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Explain how promises work in JavaScript and when to use them.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User wants to understand a concept"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 7 Failed:', error.message);
    throw error;
  }
}

async function testScriptCreationRequest() {
  console.log('\n📝 TEST 8: Script Creation Request');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Build a bash script that backs up my project files daily.";
    const result = await queryOpenAI(query, {
      schema: schemaChoiceAgentResponseSchema,
      context: "User wants an automated backup solution"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ Choice:', result.choice);
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext);
    
    return result;
  } catch (error) {
    console.error('❌ Test 8 Failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  const results = {
    passed: 0,
    failed: 0,
    total: 8
  };
  
  const tests = [
    testQuestionNeedsResponse,
    testRequestNeedsCode,
    testRequestNeedsTerminalCommand,
    testAmbiguousRequest,
    testComplexCodeRequest,
    testSystemAdministrationTask,
    testExplanationRequest,
    testScriptCreationRequest
  ];
  
  for (const test of tests) {
    try {
      await test();
      results.passed++;
    } catch (error) {
      results.failed++;
      console.error('\n⚠️  Test encountered an error:', error.message);
    }
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed successfully!');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
  
  return results;
}

// Run tests
runAllTests()
  .then((results) => {
    process.exit(results.failed === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Fatal error running tests:', error);
    process.exit(1);
  });
