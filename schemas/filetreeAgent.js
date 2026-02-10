//schema to return a file tree structure, with reasoning and missing context if applicable

export const filetreeAgentResponseSchema = {
  type: "object",
  properties: {
    fileTree: {
      type: "string",
      description: "A string representation of the file tree structure using a hierarchical format with paths separated by slashes. Each file or directory on a new line, with proper indentation or path notation."
    },
    reasoning: {
      type: "string",
      description: "The reasoning or rationale that justifies the structure of the file tree and how it should be interpreted."
    },
    missingContext: {
      type: "array",
      description: "List of information, data, or prerequisites that are not currently available but are required to understand or utilize the file tree effectively.",
      items: {
        type: "string"
      }
    }
  },
  required: ["fileTree", "reasoning", "missingContext"],
  additionalProperties: false
};  