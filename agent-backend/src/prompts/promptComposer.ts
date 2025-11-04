/**
 * Combines instruction text with a payload string, ensuring there is exactly one
 * blank line between them. The instructions are preserved verbatim.
 */
export function prependInstructionsToPayload(instructions: string, payload: string): string {
  const instructionPart = instructions.endsWith('\n') ? instructions : `${instructions}\n`;
  return `${instructionPart}\n${payload}`;
}

