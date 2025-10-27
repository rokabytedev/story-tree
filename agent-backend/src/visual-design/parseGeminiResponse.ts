import { VisualDesignTaskError } from './errors.js';

export interface VisualDesignResponsePayload {
  visualDesignDocument: unknown;
}

export function parseVisualDesignResponse(raw: string): VisualDesignResponsePayload {
  const trimmed = raw?.toString?.() ?? '';
  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new VisualDesignTaskError(
      `Gemini visual design response contained invalid JSON: ${summarizeRaw(trimmed)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new VisualDesignTaskError(
      `Gemini visual design response is not an object: ${summarizeRaw(trimmed)}`
    );
  }

  const record = parsed as Record<string, unknown>;
  const document = record.visual_design_document ?? record.visualDesignDocument;

  if (document === undefined) {
    throw new VisualDesignTaskError(
      `Gemini visual design response missing visual_design_document field: ${summarizeRaw(trimmed)}`
    );
  }

  return {
    visualDesignDocument: document,
  };
}

function summarizeRaw(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '[empty response]';
  }

  if (trimmed.length <= 200) {
    return trimmed;
  }

  return `${trimmed.slice(0, 197)}...`;
}
