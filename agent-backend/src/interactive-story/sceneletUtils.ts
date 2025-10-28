import { InteractiveStoryError } from './errors.js';
import type { DialogueLine, ScriptwriterScenelet } from './types.js';

export function cloneScenelet(scenelet: ScriptwriterScenelet): ScriptwriterScenelet {
  return {
    description: scenelet.description,
    dialogue: scenelet.dialogue.map(cloneDialogueLine),
    shot_suggestions: [...scenelet.shot_suggestions],
    ...(scenelet.choice_label ? { choice_label: scenelet.choice_label } : {}),
  };
}

export function normalizeStoredSceneletContent(
  raw: unknown,
  sceneletId: string
): ScriptwriterScenelet {
  if (!raw || typeof raw !== 'object') {
    throw new InteractiveStoryError(
      `Scenelet ${sceneletId} content must be an object with script fields.`
    );
  }

  const record = raw as Record<string, unknown>;
  const description = expectString(record.description, sceneletId, 'description');
  const dialogue = normalizeDialogue(record.dialogue, sceneletId);
  const shotSuggestions = normalizeShotSuggestions(record.shot_suggestions, sceneletId);
  const choiceLabel =
    typeof record.choice_label === 'string' && record.choice_label.trim()
      ? record.choice_label
      : undefined;

  return {
    description,
    dialogue,
    shot_suggestions: shotSuggestions,
    ...(choiceLabel ? { choice_label: choiceLabel } : {}),
  };
}

function normalizeDialogue(value: unknown, sceneletId: string): DialogueLine[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new InteractiveStoryError(
      `Scenelet ${sceneletId} dialogue must be an array of { character, line } objects.`
    );
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new InteractiveStoryError(
        `Scenelet ${sceneletId} dialogue entry ${index} must be an object.`
      );
    }

    const line = entry as Record<string, unknown>;
    const character = expectString(line.character, sceneletId, `dialogue[${index}].character`);
    const text = expectString(line.line, sceneletId, `dialogue[${index}].line`);

    return {
      character,
      line: text,
    };
  });
}

function normalizeShotSuggestions(value: unknown, sceneletId: string): string[] {
  if (!Array.isArray(value)) {
    throw new InteractiveStoryError(
      `Scenelet ${sceneletId} shot_suggestions must be an array of strings.`
    );
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new InteractiveStoryError(
        `Scenelet ${sceneletId} shot_suggestions[${index}] must be a non-empty string.`
      );
    }
    return entry;
  });
}

function expectString(value: unknown, sceneletId: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InteractiveStoryError(
      `Scenelet ${sceneletId} field ${field} must be a non-empty string.`
    );
  }
  return value;
}

function cloneDialogueLine(line: DialogueLine): DialogueLine {
  return {
    character: line.character,
    line: line.line,
  };
}
