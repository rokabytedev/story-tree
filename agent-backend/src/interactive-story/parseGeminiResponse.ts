import {
  InteractiveScriptwriterResponse,
  ScriptwriterScenelet,
} from './types.js';
import { InteractiveStoryParsingError } from './errors.js';

export function parseInteractiveScriptwriterResponse(raw: string): InteractiveScriptwriterResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InteractiveStoryParsingError(
      'Failed to parse interactive scriptwriter JSON response.',
      raw,
      { cause: error }
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InteractiveStoryParsingError(
      'Interactive scriptwriter response is not a JSON object.',
      raw
    );
  }

  const record = parsed as Record<string, unknown>;
  const branchPointValue = record.branch_point;
  const isConcludingValue = record.is_concluding_scene;

  if (typeof branchPointValue !== 'boolean') {
    throw new InteractiveStoryParsingError(
      'Interactive scriptwriter response must include branch_point boolean.',
      raw
    );
  }

  if (typeof isConcludingValue !== 'boolean') {
    throw new InteractiveStoryParsingError(
      'Interactive scriptwriter response must include is_concluding_scene boolean.',
      raw
    );
  }

  const branchPoint = branchPointValue;
  const isConcluding = isConcludingValue;
  const sceneletsValue = record.next_scenelets;

  if (!Array.isArray(sceneletsValue) || sceneletsValue.length === 0) {
    throw new InteractiveStoryParsingError(
      'Interactive scriptwriter response is missing next_scenelets.',
      raw
    );
  }

  const scenelets = sceneletsValue.map((value, index) =>
    normalizeScenelet(value, index, raw)
  );

  if (isConcluding && branchPoint) {
    throw new InteractiveStoryParsingError(
      'Interactive scriptwriter response cannot be both a branch point and concluding scene.',
      raw
    );
  }

  if (branchPoint) {
    const choicePrompt = record.choice_prompt;
    if (typeof choicePrompt !== 'string' || !choicePrompt.trim()) {
      throw new InteractiveStoryParsingError(
        'Branch response is missing a non-empty choice_prompt.',
        raw
      );
    }

    if (scenelets.length < 2) {
      throw new InteractiveStoryParsingError(
        'Branch response must include at least two scenelets.',
        raw
      );
    }

    for (const scenelet of scenelets) {
      if (typeof scenelet.choice_label !== 'string' || !scenelet.choice_label.trim()) {
        throw new InteractiveStoryParsingError(
          'Branch scenelets must include a non-empty choice_label.',
          raw
        );
      }
    }

    return {
      branch_point: true,
      is_concluding_scene: false,
      choice_prompt: choicePrompt.trim(),
      next_scenelets: scenelets as [ScriptwriterScenelet, ScriptwriterScenelet, ...ScriptwriterScenelet[]],
    };
  }

  if (isConcluding) {
    if (scenelets.length !== 1) {
      throw new InteractiveStoryParsingError(
        'Concluding response must contain exactly one scenelet.',
        raw
      );
    }

    return {
      branch_point: false,
      is_concluding_scene: true,
      next_scenelets: scenelets as [ScriptwriterScenelet],
    };
  }

  if (scenelets.length !== 1) {
    throw new InteractiveStoryParsingError(
      'Linear continuation response must contain exactly one scenelet.',
      raw
    );
  }

  return {
    branch_point: false,
    is_concluding_scene: false,
    next_scenelets: scenelets as [ScriptwriterScenelet],
  };
}

function normalizeScenelet(value: unknown, index: number, raw: string): ScriptwriterScenelet {
  if (typeof value !== 'object' || value === null) {
    throw new InteractiveStoryParsingError(
      `Scenelet at index ${index} is not an object.`,
      raw
    );
  }

  const record = value as Record<string, unknown>;
  const description = record.description;
  const dialogueRaw = record.dialogue;
  const shotSuggestionsRaw = record.shot_suggestions;
  const choiceLabel = record.choice_label;

  if (typeof description !== 'string' || !description.trim()) {
    throw new InteractiveStoryParsingError(
      `Scenelet at index ${index} is missing a non-empty description.`,
      raw
    );
  }

  if (!Array.isArray(dialogueRaw)) {
    throw new InteractiveStoryParsingError(
      `Scenelet at index ${index} is missing dialogue array.`,
      raw
    );
  }

  const dialogue = dialogueRaw.map((entry, dialogueIndex) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new InteractiveStoryParsingError(
        `Dialogue entry ${dialogueIndex} in scenelet ${index} is not an object.`,
        raw
      );
    }

    const dialogueRecord = entry as Record<string, unknown>;
    const character = dialogueRecord.character;
    const line = dialogueRecord.line;

    if (typeof character !== 'string' || !character.trim()) {
      throw new InteractiveStoryParsingError(
        `Dialogue entry ${dialogueIndex} in scenelet ${index} is missing character.`,
        raw
      );
    }

    if (typeof line !== 'string' || !line.trim()) {
      throw new InteractiveStoryParsingError(
        `Dialogue entry ${dialogueIndex} in scenelet ${index} is missing line.`,
        raw
      );
    }

    return {
      character: character.trim(),
      line: line.trim(),
    };
  });

  if (!Array.isArray(shotSuggestionsRaw)) {
    throw new InteractiveStoryParsingError(
      `Scenelet at index ${index} is missing shot_suggestions array.`,
      raw
    );
  }

  const shotSuggestions = shotSuggestionsRaw.map((entry, shotIndex) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new InteractiveStoryParsingError(
        `Shot suggestion ${shotIndex} in scenelet ${index} must be a non-empty string.`,
        raw
      );
    }

    return entry.trim();
  });

  const normalized: ScriptwriterScenelet = {
    description: description.trim(),
    dialogue,
    shot_suggestions: shotSuggestions,
  };

  if (typeof choiceLabel === 'string' && choiceLabel.trim()) {
    normalized.choice_label = choiceLabel.trim();
  }

  return normalized;
}
