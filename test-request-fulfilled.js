/**
 * Test script for request fulfillment schema
 */

import { checkRequestFulfilled } from './lib/requestFulfilled.js';
import { getMemoryContextString } from './lib/memorySystem.js';

async function run() {
  const memoryContext = await getMemoryContextString();
  const userQuery = 'Please check if the last task was completed.';

  const result = await checkRequestFulfilled(userQuery, memoryContext);
  console.log('Request fulfilled result:', result);
}

run().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
