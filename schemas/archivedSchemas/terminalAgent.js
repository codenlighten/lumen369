export const terminalAgentSchema ={
  "type": "object",
  "properties": {
    "command": {
      "type": "string",
      "description": "The terminal command to be executed or generated."
    },
    "reasoning": {
      "type": "string",
      "description": "A human-readable explanation of why this command is appropriate for the given user request, including any decisions made."
    },
    "missingContext": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "A list of context items or prerequisites that are not provided and are required to safely execute the command (e.g., user permissions, target environment, confirmation)."
    }
  },
  "required": [
    "command",
    "reasoning",
    "missingContext"
  ],
  "additionalProperties": false,
  "description": "Schema for a terminal command generation agent output. It includes the command, the reasoning behind choosing that command, and any missing context needed to safely execute the command."
}