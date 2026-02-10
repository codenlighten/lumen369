export const schemaGeneratorResponseSchema = {
  type: "object",
  properties: {
    schemaAsString: { 
      type: "string",
      description: "A standalone, valid JSON Schema string. It MUST: 1) Include a '$schema' keyword (e.g., 'http://json-schema.org/draft-07/schema#'). 2) Use 'additionalProperties: false' for all objects. 3) Provide clear 'description' strings for every property to aid documentation. 4) Use 'camelCase' for property keys."
    },
    missingContext: {
      type: "array",
      items: { type: "string" },
      description: "Specific questions for the user to clarify ambiguity (e.g., 'What are the valid ranges for the age field?'). Return an empty array if the prompt was highly specific."
    },
    reasoning: {
      type: "string",
      description: "A concise explanation of why specific types (e.g., 'integer' vs 'number') or formats (e.g., 'date-time') were chosen."
    }
  },
  required: ["schemaAsString", "missingContext", "reasoning"],
  additionalProperties: false
};