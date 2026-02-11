/**
 * Request Fulfillment Checker
 * 
 * Uses OpenAI with a strict schema to decide if the user's request
 * has been fully satisfied based on the conversation memory.
 */

import { queryOpenAI } from './openaiWrapper.js';
import { requestFulfilledSchema } from '../schemas/baseAgent.js';
import { getMemoryContextString } from './memorySystem.js';

/**
 * Check if the user's request is fulfilled.
 * @param {string} userQuery - The latest user request
 * @param {string} [memoryContext] - Optional precomputed memory context
 * @returns {Promise<{requestFulfilled: boolean}>}
 */
export async function checkRequestFulfilled(userQuery, memoryContext = null) {
  const context = memoryContext ?? await getMemoryContextString();

  const prompt = `You are validating whether the user's request has been fully satisfied.
Return only JSON that matches the schema.

User request:
${userQuery}

Conversation memory:
${context}`;

  const result = await queryOpenAI(prompt, {
    schema: requestFulfilledSchema,
    context
  });

  return result;
}
