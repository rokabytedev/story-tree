import { CharacterModelSheetTaskError } from './errors.js';

// IMPORTANT: This prompt template is exactly as specified in docs/018_visual_reference_image_structured_prompt_plan.md
// DO NOT modify this template without updating the source document
const MODEL_SHEET_PROMPT_TEMPLATE = `Character model sheet, character design sheet, concept art for animation, professional production art.
A 3-row grid layout.
**Top row:** Full body character turnaround in a T-pose. Clean orthographic views showing front, left side, right side, and back.
**Middle row:** Four headshots demonstrating key facial expressions: neutral, happy, sad, angry.
**Bottom row:** Four dynamic action poses: a ready stance, a walking pose, a running pose, and a jumping pose.
**Style:** Clean digital painting, detailed character render, full color, clear lines.
**Lighting & Background:** Bright, even studio lighting with soft shadows, set against a solid neutral gray background for maximum clarity.
**Constraint:** The image must not contain any text, letters, numbers, annotations, or watermarks. Purely visual with no typography.`;

export interface GlobalAesthetic {
  visual_style?: unknown;
  master_color_palette?: unknown;
  [key: string]: unknown;
}

export interface CharacterDesign {
  character_id: string;
  character_name: string;
  [key: string]: unknown;
}

export interface VisualDesignDocument {
  global_aesthetic?: GlobalAesthetic;
  character_designs?: CharacterDesign[];
  [key: string]: unknown;
}

/**
 * Extracts the global_aesthetic object from the visual design document
 */
export function extractGlobalAesthetic(visualDesignDocument: VisualDesignDocument): GlobalAesthetic {
  if (!visualDesignDocument.global_aesthetic) {
    throw new CharacterModelSheetTaskError(
      'Visual design document is missing global_aesthetic field'
    );
  }
  return visualDesignDocument.global_aesthetic;
}

/**
 * Extracts a specific character design by character_id from the visual design document
 */
export function extractCharacterDesign(
  visualDesignDocument: VisualDesignDocument,
  characterId: string
): CharacterDesign {
  if (!visualDesignDocument.character_designs || visualDesignDocument.character_designs.length === 0) {
    throw new CharacterModelSheetTaskError(
      'Visual design document has no character designs'
    );
  }

  const characterDesign = visualDesignDocument.character_designs.find(
    (design) => design.character_id === characterId
  );

  if (!characterDesign) {
    const availableIds = visualDesignDocument.character_designs
      .map((d) => d.character_id)
      .join(', ');
    throw new CharacterModelSheetTaskError(
      `Character with id "${characterId}" not found in visual design document. Available: ${availableIds}`
    );
  }

  return characterDesign;
}

/**
 * Builds the complete structured prompt for character model sheet generation
 * Uses the exact template from docs/018_visual_reference_image_structured_prompt_plan.md
 */
export function buildModelSheetPrompt(
  globalAesthetic: GlobalAesthetic,
  characterDesign: CharacterDesign
): string {
  // Build the JSON data block (without comments in actual output)
  const dataBlock = {
    global_aesthetic: globalAesthetic,
    character_design: characterDesign,
  };

  // Combine the template with the JSON data
  const prompt = `${MODEL_SHEET_PROMPT_TEMPLATE}

${JSON.stringify(dataBlock, null, 2)}`;

  return prompt;
}
