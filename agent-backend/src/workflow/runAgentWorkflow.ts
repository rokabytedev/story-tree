import type { AgentWorkflowOptions, AgentWorkflowResult } from './types.js';
import { createWorkflowFromPrompt } from './storyWorkflow.js';

export async function runAgentWorkflow(
  prompt: string,
  options: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
  const workflow = await createWorkflowFromPrompt(prompt, options);
  return workflow.runAllTasks();
}
