import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from '../src/cli/agentWorkflowCli.js';

describe('agentWorkflow CLI', () => {
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      logs.push(String(value ?? ''));
    });
    vi.spyOn(console, 'error').mockImplementation((value?: unknown) => {
      errors.push(String(value ?? ''));
    });
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    logs.length = 0;
    errors.length = 0;
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('runs in stub mode and prints final tables', async () => {
    await runCli(['--prompt', 'Stub adventure', '--stub'], {});

    expect(errors).toEqual([]);
    expect(process.exitCode).toBeUndefined();
    expect(logs.length).toBeGreaterThanOrEqual(3);
    const result = JSON.parse(logs[0]);
    expect(result.storyTitle).toBe('Stubbed Story Constitution');
    expect(result.storyConstitutionMarkdown).toContain('Stub adventure');
    expect(logs).toContain('--- Stub Stories Table ---');
    expect(logs).toContain('--- Stub Scenelets Table ---');
  });

  it('errors when prompt missing', async () => {
    await runCli(['--stub'], {});

    expect(process.exitCode).toBe(1);
    expect(errors.some((line) => line.includes('Provide a story prompt'))).toBe(true);
  });

  it('prints debug logs when verbose flag enabled', async () => {
    await runCli(['--prompt', 'Stub adventure', '--stub', '--verbose'], {});

    expect(logs.some((line) => line.includes('[agent-workflow]'))).toBe(true);
    expect(logs.some((line) => line.includes('Interactive story Gemini request'))).toBe(true);
  });
});
