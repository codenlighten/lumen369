/**
 * Manual test for Request Fulfilled Agent
 */
import { evaluateRequestFulfilled } from '../lib/requestFulfilledAgent.js';

async function runTest() {
  const userRequest = 'Add a footer to the web UI with copyright text.';
  const mockContext = `User asked to add a footer. Assistant added footer HTML/CSS and deployed.`;

  const result = await evaluateRequestFulfilled(userRequest, { context: mockContext });
  console.log('Request:', userRequest);
  console.log('Result:', result);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
