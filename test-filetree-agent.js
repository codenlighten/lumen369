import { queryOpenAI } from './lib/openaiWrapper.js';
import { filetreeAgentResponseSchema } from './schemas/filetreeAgent.js';

/**
 * Test file for openaiWrapper.js using filetreeAgent.js schema
 * 
 * Tests the ability to generate file tree structures with reasoning
 */

console.log('═══════════════════════════════════════════════════════════');
console.log('Testing OpenAI Wrapper with File Tree Agent Schema');
console.log('═══════════════════════════════════════════════════════════\n');

async function testBasicProjectStructure() {
  console.log('\n📁 TEST 1: Basic Node.js Project Structure');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Generate a file tree structure for a basic Node.js REST API project with Express.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "User wants to scaffold a new REST API project"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
    throw error;
  }
}

async function testReactProjectStructure() {
  console.log('\n⚛️  TEST 2: React Application Structure');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Create a file tree for a React application with components, pages, and utilities.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "User wants to organize a React project properly"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
    throw error;
  }
}

async function testMicroserviceStructure() {
  console.log('\n🔧 TEST 3: Microservice Architecture');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Generate a file tree for a microservice handling user authentication.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "Building an authentication microservice with JWT tokens"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
    throw error;
  }
}

async function testLibraryStructure() {
  console.log('\n📚 TEST 4: NPM Library Structure');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Create a file tree for an NPM library package that provides utility functions.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "Publishing a new utility library to NPM"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
    throw error;
  }
}

async function testFullStackStructure() {
  console.log('\n🌐 TEST 5: Full Stack Application');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Generate a complete file tree for a full stack application with separate frontend and backend.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "Building a full stack e-commerce application"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 5 Failed:', error.message);
    throw error;
  }
}

async function testMissingContextScenario() {
  console.log('\n❓ TEST 6: Missing Context Detection');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Generate a file tree for my project.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "User hasn't specified what kind of project"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 6 Failed:', error.message);
    throw error;
  }
}

async function testComplexNestedStructure() {
  console.log('\n🏗️  TEST 7: Complex Nested Structure');
  console.log('─────────────────────────────────────────────────────────');
  
  try {
    const query = "Create a deeply nested file tree for a monorepo with multiple packages, shared libraries, and configuration files.";
    const result = await queryOpenAI(query, {
      schema: filetreeAgentResponseSchema,
      context: "Setting up a monorepo with Lerna or Nx"
    });
    
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    console.log('✓ File Tree:', JSON.stringify(result.fileTree, null, 2));
    console.log('✓ Reasoning:', result.reasoning);
    console.log('✓ Missing Context:', result.missingContext || 'None');
    
    return result;
  } catch (error) {
    console.error('❌ Test 7 Failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  const results = {
    passed: 0,
    failed: 0,
    total: 7
  };
  
  const tests = [
    testBasicProjectStructure,
    testReactProjectStructure,
    testMicroserviceStructure,
    testLibraryStructure,
    testFullStackStructure,
    testMissingContextScenario,
    testComplexNestedStructure
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
