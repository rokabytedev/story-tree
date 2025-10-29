import { VisualDesignTaskError } from './errors.js';
import { normalizeNameToId } from './utils.js';

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

  // Normalize the document by adding ID fields for characters and environments
  const normalizedDocument = normalizeVisualDesignDocument(document);

  return {
    visualDesignDocument: normalizedDocument,
  };
}

/**
 * Normalizes a visual design document by replacing name fields with normalized ID fields.
 * This makes name matching more reliable by using consistent slug-style identifiers.
 *
 * @param document The visual design document from Gemini
 * @returns The normalized document with only character_id and environment_id fields
 */
function normalizeVisualDesignDocument(document: unknown): unknown {
  if (!document || typeof document !== 'object') {
    return document;
  }

  const doc = document as Record<string, unknown>;
  const result = { ...doc };

  // Normalize character designs - replace name with ID
  if (Array.isArray(doc.character_designs)) {
    result.character_designs = doc.character_designs.map((char) => {
      if (char && typeof char === 'object') {
        const charObj = { ...(char as Record<string, unknown>) };
        const characterName = charObj.character_name ?? charObj.characterName;

        if (typeof characterName === 'string') {
          // Replace name field with ID field
          delete charObj.character_name;
          delete charObj.characterName;
          return {
            ...charObj,
            character_id: normalizeNameToId(characterName),
          };
        }
      }
      return char;
    });
  } else if (Array.isArray(doc.characterDesigns)) {
    result.characterDesigns = doc.characterDesigns.map((char) => {
      if (char && typeof char === 'object') {
        const charObj = { ...(char as Record<string, unknown>) };
        const characterName = charObj.character_name ?? charObj.characterName;

        if (typeof characterName === 'string') {
          // Replace name field with ID field
          delete charObj.character_name;
          delete charObj.characterName;
          return {
            ...charObj,
            character_id: normalizeNameToId(characterName),
          };
        }
      }
      return char;
    });
  }

  // Normalize environment designs - replace name with ID
  if (Array.isArray(doc.environment_designs)) {
    result.environment_designs = doc.environment_designs.map((env) => {
      if (env && typeof env === 'object') {
        const envObj = { ...(env as Record<string, unknown>) };
        const environmentName = envObj.environment_name ?? envObj.environmentName;

        if (typeof environmentName === 'string') {
          // Replace name field with ID field
          delete envObj.environment_name;
          delete envObj.environmentName;
          return {
            ...envObj,
            environment_id: normalizeNameToId(environmentName),
          };
        }
      }
      return env;
    });
  } else if (Array.isArray(doc.environmentDesigns)) {
    result.environmentDesigns = doc.environmentDesigns.map((env) => {
      if (env && typeof env === 'object') {
        const envObj = { ...(env as Record<string, unknown>) };
        const environmentName = envObj.environment_name ?? envObj.environmentName;

        if (typeof environmentName === 'string') {
          // Replace name field with ID field
          delete envObj.environment_name;
          delete envObj.environmentName;
          return {
            ...envObj,
            environment_id: normalizeNameToId(environmentName),
          };
        }
      }
      return env;
    });
  }

  return result;
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
