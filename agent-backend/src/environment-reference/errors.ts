export interface EnvironmentReferenceTaskErrorContext {
  environmentId?: string;
  environmentName?: string;
  cause?: unknown;
}

export class EnvironmentReferenceTaskError extends Error {
  readonly environmentId?: string;
  readonly environmentName?: string;

  constructor(message: string, context: EnvironmentReferenceTaskErrorContext = {}) {
    super(message, context.cause instanceof Error ? { cause: context.cause } : undefined);
    this.name = 'EnvironmentReferenceTaskError';
    this.environmentId = context.environmentId;
    this.environmentName = context.environmentName;
    if (context.cause && !(context.cause instanceof Error)) {
      this.cause = context.cause as unknown;
    }
  }
}
