import { EnvironmentReferenceTaskError } from './errors.js';

export interface GlobalAesthetic {
  [key: string]: unknown;
}

export interface EnvironmentDetailedDescription {
  color_tones?: unknown;
  key_elements?: unknown;
  overall_description?: unknown;
  lighting_and_atmosphere?: unknown;
  [key: string]: unknown;
}

export interface EnvironmentDesign {
  environment_id: string;
  environment_name?: string;
  environment_reference_image_path?: string | null;
  detailed_description?: EnvironmentDetailedDescription;
  [key: string]: unknown;
}

export interface VisualDesignDocument {
  global_aesthetic?: GlobalAesthetic;
  environment_designs?: EnvironmentDesign[];
  [key: string]: unknown;
}

const ENVIRONMENT_PROMPT_TEMPLATE = `# Role: Environment Concept Artist

Your purpose is to generate high-fidelity environment reference images for film, animation, and game production. The output must serve as a precise visual guide for a specific scene.

# Core Directive: Strict Adherence to the User's Prompt

Your most critical function is to create an image that is a direct and literal visualization of the user's request.

*   **Analyze:** Deconstruct the user's prompt to identify every specified element: objects, lighting, atmosphere, color palette, camera angle, and composition.
*   **Construct:** Build the scene using *only* the elements explicitly mentioned.
*   **Omit:** Do not add, invent, or infer any objects, characters, animals, or environmental details that are not described in the prompt. Your role is to be a precise tool, not an interpretive artist.`;

export function parseVisualDesignDocument(raw: unknown): VisualDesignDocument | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as VisualDesignDocument;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new EnvironmentReferenceTaskError('visual_design_document must be a JSON object.');
      }
      return parsed as VisualDesignDocument;
    } catch (error) {
      throw new EnvironmentReferenceTaskError(
        'visual_design_document must be valid JSON when provided as a string.',
        { cause: error }
      );
    }
  }

  throw new EnvironmentReferenceTaskError('visual_design_document must be an object or JSON string.');
}

export function extractGlobalAesthetic(
  visualDesignDocument: VisualDesignDocument
): GlobalAesthetic {
  if (!visualDesignDocument || typeof visualDesignDocument !== 'object') {
    throw new EnvironmentReferenceTaskError('visual design document is missing or invalid.');
  }

  if (!visualDesignDocument.global_aesthetic) {
    throw new EnvironmentReferenceTaskError(
      'Visual design document is missing required global_aesthetic section.'
    );
  }

  return visualDesignDocument.global_aesthetic;
}

export function extractEnvironmentDesign(
  visualDesignDocument: VisualDesignDocument,
  environmentId: string
): EnvironmentDesign {
  if (!visualDesignDocument.environment_designs || visualDesignDocument.environment_designs.length === 0) {
    throw new EnvironmentReferenceTaskError(
      'Visual design document has no environment designs.'
    );
  }

  const target = visualDesignDocument.environment_designs.find(
    (design) => design.environment_id === environmentId
  );

  if (!target) {
    const available = visualDesignDocument.environment_designs
      .map((design) => design.environment_id)
      .filter(Boolean)
      .join(', ');
    throw new EnvironmentReferenceTaskError(
      `Environment with id "${environmentId}" not found in visual design document. Available: ${available}`
    );
  }

  return target;
}

export function buildEnvironmentReferencePrompt(
  globalAesthetic: GlobalAesthetic,
  environmentDesign: EnvironmentDesign
): string {
  const sanitizedEnvironment = sanitizeEnvironmentDesign(environmentDesign);

  const dataBlock = {
    global_aesthetic: globalAesthetic,
    environment_design: sanitizedEnvironment,
  };

  return `${ENVIRONMENT_PROMPT_TEMPLATE}

${JSON.stringify(dataBlock, null, 2)}`;
}

function sanitizeEnvironmentDesign(design: EnvironmentDesign): EnvironmentDesign {
  if (!design || typeof design !== 'object') {
    return design;
  }

  const cloned = { ...design } as Record<string, unknown>;
  let mutated = false;

  if (Object.prototype.hasOwnProperty.call(cloned, 'associated_scenelet_ids')) {
    delete cloned['associated_scenelet_ids'];
    mutated = true;
  }

  if (Object.prototype.hasOwnProperty.call(cloned, 'associatedSceneletIds')) {
    delete cloned['associatedSceneletIds'];
    mutated = true;
  }

  if (Object.prototype.hasOwnProperty.call(cloned, 'environment_reference_image_path')) {
    delete cloned['environment_reference_image_path'];
    mutated = true;
  }

  if (Object.prototype.hasOwnProperty.call(cloned, 'environmentReferenceImagePath')) {
    delete cloned['environmentReferenceImagePath'];
    mutated = true;
  }

  return mutated ? (cloned as EnvironmentDesign) : design;
}
