import { VisualReferenceTaskError } from './errors.js';
import { normalizeNameToId } from '../visual-design/utils.js';

export interface VisualReferenceValidationOptions {
  visualDesignDocument: unknown;
  minimumPromptLength: number;
}

export interface VisualReferenceValidationResult {
  visualReferencePackage: Record<string, unknown>;
}

type JsonRecord = Record<string, unknown>;

export function validateVisualReferenceResponse(
  rawResponse: string,
  options: VisualReferenceValidationOptions
): VisualReferenceValidationResult {
  const trimmed = rawResponse?.toString?.() ?? '';
  if (!trimmed.trim()) {
    throw new VisualReferenceTaskError('Gemini visual reference response was empty.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new VisualReferenceTaskError(
      `Gemini visual reference response contained invalid JSON: ${summarizeRaw(trimmed)}`
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new VisualReferenceTaskError(
      `Gemini visual reference response must be an object: ${summarizeRaw(trimmed)}`
    );
  }

  const record = parsed as JsonRecord;
  const packageCandidate = resolveField(record, ['visual_reference_package'], ['visualReferencePackage']);

  if (!packageCandidate || typeof packageCandidate !== 'object' || Array.isArray(packageCandidate)) {
    throw new VisualReferenceTaskError(
      'Gemini visual reference response missing visual_reference_package object.'
    );
  }

  const visualDesign = normalizeVisualDesignDocument(options.visualDesignDocument);
  const requiredCharacterNames = extractNames(visualDesign, ['character_designs'], ['characterDesigns'], 'character_name');
  const requiredEnvironmentNames = extractNames(
    visualDesign,
    ['environment_designs'],
    ['environmentDesigns'],
    'environment_name'
  );

  // Extract normalized IDs for reliable matching
  const requiredCharacterIds = extractIds(
    visualDesign,
    ['character_designs'],
    ['characterDesigns'],
    'character_name',
    'character_id'
  );
  const requiredEnvironmentIds = extractIds(
    visualDesign,
    ['environment_designs'],
    ['environmentDesigns'],
    'environment_name',
    'environment_id'
  );

  if (requiredCharacterNames.length === 0) {
    throw new VisualReferenceTaskError(
      'Visual design document must include character_designs with character_name for visual reference validation.'
    );
  }
  if (requiredEnvironmentNames.length === 0) {
    throw new VisualReferenceTaskError(
      'Visual design document must include environment_designs with environment_name for visual reference validation.'
    );
  }

  const packageRecord = packageCandidate as JsonRecord;
  const sanitizedPackage: JsonRecord = { ...packageRecord };

  const characterSheetsRaw = resolveArray(packageRecord, ['character_model_sheets'], ['characterModelSheets']);
  const seenCharacters = new Set<string>();
  const sanitizedCharacterSheets = characterSheetsRaw.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.character_model_sheets[${index}] must be an object.`
      );
    }

    const sheetRecord = entry as JsonRecord;
    const name = resolveStringField(
      sheetRecord,
      ['character_name'],
      ['characterName'],
      `visual_reference_package.character_model_sheets[${index}].character_name`
    );

    // Normalize the character name to an ID for reliable matching
    const characterId = normalizeNameToId(name);

    if (!requiredCharacterIds.includes(characterId)) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.character_model_sheets[${index}] referenced unknown character "${name}" (normalized: "${characterId}").`
      );
    }

    if (seenCharacters.has(characterId)) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.character_model_sheets includes duplicate entry for character "${name}".`
      );
    }
    seenCharacters.add(characterId);

    const platesRaw = resolveArray(
      sheetRecord,
      ['reference_plates'],
      ['referencePlates'],
      `visual_reference_package.character_model_sheets[${index}].reference_plates`
    );

    if (platesRaw.length === 0) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.character_model_sheets[${index}].reference_plates must include at least one entry.`
      );
    }

    let modelSheetCount = 0;
    const sanitizedPlates = platesRaw.map((plate, plateIndex) => {
      if (!plate || typeof plate !== 'object' || Array.isArray(plate)) {
        throw new VisualReferenceTaskError(
          `visual_reference_package.character_model_sheets[${index}].reference_plates[${plateIndex}] must be an object.`
        );
      }

      const plateRecord = plate as JsonRecord;
      const description = resolveStringField(
        plateRecord,
        ['plate_description'],
        ['plateDescription'],
        `visual_reference_package.character_model_sheets[${index}].reference_plates[${plateIndex}].plate_description`
      );
      const type = resolveStringField(
        plateRecord,
        ['type'],
        ['plate_type'],
        `visual_reference_package.character_model_sheets[${index}].reference_plates[${plateIndex}].type`
      );
      const prompt = resolveStringField(
        plateRecord,
        ['image_generation_prompt'],
        ['imageGenerationPrompt'],
        `visual_reference_package.character_model_sheets[${index}].reference_plates[${plateIndex}].image_generation_prompt`
      );

      if (type === 'CHARACTER_MODEL_SHEET') {
        modelSheetCount += 1;
      }

      if (!promptContainsName(prompt, name, characterId)) {
        throw new VisualReferenceTaskError(
          `visual_reference_package.character_model_sheets[${index}].reference_plates[${plateIndex}] prompt must include the character name "${name}".`
        );
      }

      ensurePromptLength(
        prompt,
        options.minimumPromptLength,
        `visual_reference_package.character_model_sheets[${index}].reference_plates[${plateIndex}].image_generation_prompt`
      );

      const sanitizedPlate: JsonRecord = {
        ...plateRecord,
        plate_description: description,
        type,
        image_generation_prompt: prompt,
      };
      delete sanitizedPlate.imageGenerationPrompt;
      delete sanitizedPlate.plateDescription;

      return sanitizedPlate;
    });

    if (modelSheetCount === 0) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.character_model_sheets[${index}] must include a CHARACTER_MODEL_SHEET reference plate.`
      );
    }

    const sanitizedSheet: JsonRecord = {
      ...sheetRecord,
      character_name: name,
      reference_plates: sanitizedPlates,
    };
    delete sanitizedSheet.characterName;
    delete sanitizedSheet.referencePlates;

    return sanitizedSheet;
  });

  // Check for missing characters using normalized IDs
  const missingCharacterIds = requiredCharacterIds.filter((id) => !seenCharacters.has(id));
  if (missingCharacterIds.length > 0) {
    // Map back to original names for error message
    const missingNames = missingCharacterIds.map((id) => {
      const index = requiredCharacterIds.indexOf(id);
      return requiredCharacterNames[index];
    });
    throw new VisualReferenceTaskError(
      `visual_reference_package.character_model_sheets missing entries for: ${missingNames.join(', ')}.`
    );
  }

  const environmentEntriesRaw = resolveArray(
    packageRecord,
    ['environment_keyframes'],
    ['environmentKeyframes']
  );

  const seenEnvironments = new Set<string>();
  const sanitizedEnvironmentEntries = environmentEntriesRaw.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.environment_keyframes[${index}] must be an object.`
      );
    }

    const envRecord = entry as JsonRecord;
    const name = resolveStringField(
      envRecord,
      ['environment_name'],
      ['environmentName'],
      `visual_reference_package.environment_keyframes[${index}].environment_name`
    );

    // Normalize the environment name to an ID for reliable matching
    const environmentId = normalizeNameToId(name);

    if (!requiredEnvironmentIds.includes(environmentId)) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.environment_keyframes[${index}] referenced unknown environment "${name}" (normalized: "${environmentId}").`
      );
    }

    if (seenEnvironments.has(environmentId)) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.environment_keyframes includes duplicate entry for environment "${name}".`
      );
    }
    seenEnvironments.add(environmentId);

    const keyframesRaw = resolveArray(
      envRecord,
      ['keyframes'],
      ['environment_keyframes_entries'],
      `visual_reference_package.environment_keyframes[${index}].keyframes`
    );

    if (keyframesRaw.length === 0) {
      throw new VisualReferenceTaskError(
        `visual_reference_package.environment_keyframes[${index}].keyframes must include at least one entry.`
      );
    }

    const sanitizedKeyframes = keyframesRaw.map((keyframe, frameIndex) => {
      if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe)) {
        throw new VisualReferenceTaskError(
          `visual_reference_package.environment_keyframes[${index}].keyframes[${frameIndex}] must be an object.`
        );
      }

      const frameRecord = keyframe as JsonRecord;
      const description = resolveStringField(
        frameRecord,
        ['keyframe_description'],
        ['keyframeDescription'],
        `visual_reference_package.environment_keyframes[${index}].keyframes[${frameIndex}].keyframe_description`
      );
      const prompt = resolveStringField(
        frameRecord,
        ['image_generation_prompt'],
        ['imageGenerationPrompt'],
        `visual_reference_package.environment_keyframes[${index}].keyframes[${frameIndex}].image_generation_prompt`
      );

      if (!promptContainsName(prompt, name, environmentId)) {
        throw new VisualReferenceTaskError(
          `visual_reference_package.environment_keyframes[${index}].keyframes[${frameIndex}] prompt must include the environment name "${name}".`
        );
      }

      ensurePromptLength(
        prompt,
        options.minimumPromptLength,
        `visual_reference_package.environment_keyframes[${index}].keyframes[${frameIndex}].image_generation_prompt`
      );

      if (!containsLightingLanguage(prompt)) {
        throw new VisualReferenceTaskError(
          `visual_reference_package.environment_keyframes[${index}].keyframes[${frameIndex}] prompt must describe lighting or atmosphere.`
        );
      }

      const sanitizedFrame: JsonRecord = {
        ...frameRecord,
        keyframe_description: description,
        image_generation_prompt: prompt,
      };
      delete sanitizedFrame.keyframeDescription;
      delete sanitizedFrame.imageGenerationPrompt;

      return sanitizedFrame;
    });

    const sanitizedEnvironment: JsonRecord = {
      ...envRecord,
      environment_name: name,
      keyframes: sanitizedKeyframes,
    };
    delete sanitizedEnvironment.environmentName;
    delete sanitizedEnvironment.environment_keyframes_entries;

    return sanitizedEnvironment;
  });

  // Check for missing environments using normalized IDs
  const missingEnvironmentIds = requiredEnvironmentIds.filter((id) => !seenEnvironments.has(id));
  if (missingEnvironmentIds.length > 0) {
    // Map back to original names for error message
    const missingNames = missingEnvironmentIds.map((id) => {
      const index = requiredEnvironmentIds.indexOf(id);
      return requiredEnvironmentNames[index];
    });
    throw new VisualReferenceTaskError(
      `visual_reference_package.environment_keyframes missing entries for: ${missingNames.join(', ')}.`
    );
  }

  sanitizedPackage.character_model_sheets = sanitizedCharacterSheets;
  delete sanitizedPackage.characterModelSheets;

  sanitizedPackage.environment_keyframes = sanitizedEnvironmentEntries;
  delete sanitizedPackage.environmentKeyframes;

  return {
    visualReferencePackage: sanitizedPackage,
  };
}

function normalizeVisualDesignDocument(document: unknown): JsonRecord {
  if (document === null || document === undefined) {
    throw new VisualReferenceTaskError('Visual design document is required to validate visual reference package.');
  }

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new VisualReferenceTaskError('Visual design document string must not be empty.');
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not object');
      }
      return parsed as JsonRecord;
    } catch {
      throw new VisualReferenceTaskError(
        'Visual design document string must contain valid JSON describing character and environment designs.'
      );
    }
  }

  if (typeof document === 'object' && !Array.isArray(document)) {
    return document as JsonRecord;
  }

  throw new VisualReferenceTaskError('Visual design document must be an object or JSON string.');
}

function extractNames(
  document: JsonRecord,
  preferredKeys: string[],
  alternateKeys: string[],
  fieldKey: string
): string[] {
  const containerLabel = `visual_design_document.${preferredKeys[0]}`;
  const entries = resolveArray(document, preferredKeys, alternateKeys, containerLabel, true);
  const names: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new VisualReferenceTaskError(
        `${preferredKeys[0]}.${fieldKey} entry at index ${index} must be an object.`
      );
    }

    const name = resolveStringField(
      entry as JsonRecord,
      [fieldKey],
      [camelCase(fieldKey)],
      `${preferredKeys[0]}[${index}].${fieldKey}`
    );
    names.push(name);
  }

  return names;
}

/**
 * Extracts normalized IDs from character or environment designs in the visual design document.
 * If the document already has ID fields (character_id/environment_id), uses those.
 * Otherwise, normalizes the name fields to generate IDs.
 *
 * @param document Visual design document
 * @param preferredKeys Preferred keys for the container array (e.g., ['character_designs'])
 * @param alternateKeys Alternate keys for the container array (e.g., ['characterDesigns'])
 * @param nameFieldKey Key for the name field (e.g., 'character_name')
 * @param idFieldKey Key for the ID field (e.g., 'character_id')
 * @returns Array of normalized IDs
 */
function extractIds(
  document: JsonRecord,
  preferredKeys: string[],
  alternateKeys: string[],
  nameFieldKey: string,
  idFieldKey: string
): string[] {
  const containerLabel = `visual_design_document.${preferredKeys[0]}`;
  const entries = resolveArray(document, preferredKeys, alternateKeys, containerLabel, true);
  const ids: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new VisualReferenceTaskError(
        `${preferredKeys[0]}.${nameFieldKey} entry at index ${index} must be an object.`
      );
    }

    const entryRecord = entry as JsonRecord;

    // Try to get the ID field first (if document was normalized during parsing)
    const existingId = resolveField(entryRecord, [idFieldKey], [camelCase(idFieldKey)]);
    if (typeof existingId === 'string' && existingId.trim()) {
      ids.push(existingId);
      continue;
    }

    // Fallback: normalize the name field to generate an ID
    const name = resolveStringField(
      entryRecord,
      [nameFieldKey],
      [camelCase(nameFieldKey)],
      `${preferredKeys[0]}[${index}].${nameFieldKey}`
    );
    ids.push(normalizeNameToId(name));
  }

  return ids;
}

function resolveField(record: JsonRecord, primary: string[], secondary: string[]): unknown {
  for (const key of primary) {
    if (key in record) {
      return record[key];
    }
  }
  for (const key of secondary) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function resolveArray(
  record: JsonRecord,
  primary: string[],
  secondary: string[],
  label?: string,
  allowMissing = false
): unknown[] {
  const value = resolveField(record, primary, secondary);
  if (value === undefined || value === null) {
    if (allowMissing) {
      return [];
    }
    throw new VisualReferenceTaskError(
      `${label ?? primary[0]} array is required in visual reference payload.`
    );
  }

  if (!Array.isArray(value)) {
    throw new VisualReferenceTaskError(`${label ?? primary[0]} must be an array.`);
  }

  return value;
}

function resolveStringField(
  record: JsonRecord,
  primary: string[],
  secondary: string[],
  label: string
): string {
  const value = resolveField(record, primary, secondary);
  if (typeof value !== 'string') {
    throw new VisualReferenceTaskError(`${label} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new VisualReferenceTaskError(`${label} must not be empty.`);
  }

  return trimmed;
}

function ensurePromptLength(prompt: string, minimum: number, label: string): void {
  const normalized = prompt.trim();
  if (normalized.length < minimum) {
    throw new VisualReferenceTaskError(
      `${label} must be at least ${minimum} characters; received ${normalized.length}.`
    );
  }
}

/**
 * Checks if a prompt contains a character or environment name.
 * Uses normalized ID matching for more reliable validation that's resilient to:
 * - Apostrophes and special characters ("Cosmo's" vs "Cosmos")
 * - Case variations
 * - Minor formatting differences
 *
 * @param prompt The image generation prompt to check
 * @param name The original character or environment name
 * @param normalizedId The normalized ID to match against
 * @returns true if the prompt contains the name (matched by normalized ID)
 */
function promptContainsName(prompt: string, name: string, normalizedId: string): boolean {
  // Normalize the entire prompt to an ID format and check if it contains the normalized ID
  const promptNormalized = normalizeNameToId(prompt);
  return promptNormalized.includes(normalizedId);
}

function containsLightingLanguage(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return [
    'light',
    'lighting',
    'illum',
    'shadow',
    'atmosphere',
    'mood',
    'sun',
    'dawn',
    'dusk',
    'night',
    'glow',
    'noon',
  ].some((token) => normalized.includes(token));
}

function camelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function summarizeRaw(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '[empty response]';
  }
  if (trimmed.length <= 200) {
    return trimmed;
  }
  return `${trimmed.slice(0, 197)}...`;
}
