/**
 * Request Fulfilled Agent
 * 
 * Standalone evaluator that uses OpenAI + conversation memory to determine
 * whether a user's request has been fully completed.
 */

import { queryOpenAI } from './openaiWrapper.js';
import { getMemoryContextString } from './memorySystem.js';
import { requestFulfilledResponseSchema } from '../schemas/requestFulfilledAgent.js';

/**
 * Evaluate whether a request has been fulfilled.
 * @param {string} userRequest - The user's request to evaluate
 * @param {object} options - Optional overrides
 * @param {string} options.context - Provide custom context instead of memory
 * @returns {Promise<{requestFulfilled: boolean}>}
 */
export async function evaluateRequestFulfilled(userRequest, options = {}) {
  const memoryContext = options.context ?? await getMemoryContextString();

  const prompt = `Determine whether the user's request has been fully completed.
Return requestFulfilled=true ONLY if all requested work is done.
If there is any doubt, missing step, or unverified result, return false.

User request:
${userRequest}`;

  return queryOpenAI(prompt, {
    schema: requestFulfilledResponseSchema,
    context: memoryContext,
    temperature: 0.1
  });
}
