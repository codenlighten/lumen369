/**
 * Request Fulfilled Agent Schema
 * 
 * Purpose: Determine whether the user's request has been fully completed.
 * Returns a single boolean: requestFulfilled
 */
export const requestFulfilledResponseSchema = {
  type: "object",
  properties: {
    requestFulfilled: {
      type: "boolean",
      description: "True if the user's request has been fully completed; false if any part is pending or unclear"
    }
  },
  required: ["requestFulfilled"],
  additionalProperties: false
};
