type UnknownRecord = Record<string, unknown>;

export interface VisualPaletteEntryViewModel {
  name: string;
  hex: string;
  usageNotes?: string | null;
}

export interface VisualGlobalAestheticViewModel {
  visualStyleName?: string | null;
  visualStyleDescription?: string | null;
  palette: VisualPaletteEntryViewModel[];
}

export interface VisualCharacterSummary {
  id: string;
  name?: string | null;
  role?: string | null;
  description?: string | null;
  attire?: string | null;
  physique?: string | null;
  facialFeatures?: string | null;
  imagePath?: string | null;
  sceneletIds: string[];
}

export interface VisualEnvironmentSummary {
  id: string;
  name?: string | null;
  overallDescription?: string | null;
  lighting?: string | null;
  colorTones?: string | null;
  keyElements?: string | null;
  sceneletIds: string[];
  referenceImagePath?: string | null;
}

export interface VisualDesignDocumentResult {
  globalAesthetic: VisualGlobalAestheticViewModel | null;
  characters: VisualCharacterSummary[];
  environments: VisualEnvironmentSummary[];
  raw: UnknownRecord | null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const single = coerceString(value);
  return single ? [single] : [];
}

function getRecord(value: unknown, ...keys: string[]): UnknownRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (isRecord(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function normalizeStoragePath(value: unknown): string | null {
  const raw = coerceString(value);
  if (!raw) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const trimmed = raw.replace(/^\.\//, "").replace(/^\//, "");

  if (trimmed.startsWith("generated/")) {
    return `/${trimmed}`;
  }

  if (trimmed.startsWith("generated")) {
    return `/${trimmed}`;
  }

  if (raw.startsWith("/generated/")) {
    return raw;
  }

  return `/generated/${trimmed}`;
}

function joinList(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const sanitized = coerceStringArray(value);
    if (sanitized.length === 0) {
      return null;
    }
    return sanitized.join("\n");
  }

  return coerceString(value);
}

function parseGlobalAesthetic(record: UnknownRecord): VisualGlobalAestheticViewModel | null {
  const container =
    getRecord(record, "global_aesthetic", "globalAesthetic") ?? null;

  if (!container) {
    return null;
  }

  const visualStyleRecord =
    getRecord(container, "visual_style", "visualStyle") ?? null;

  const visualStyleName = coerceString(
    visualStyleRecord?.name ?? container.visual_style_name ?? container.name
  );
  const visualStyleDescription = coerceString(
    visualStyleRecord?.description ??
      container.visual_style_description ??
      container.description
  );

  const paletteRaw =
    (container.master_color_palette ?? container.masterColorPalette) ?? [];
  const paletteEntries = Array.isArray(paletteRaw) ? paletteRaw : [];

  const palette: VisualPaletteEntryViewModel[] = paletteEntries
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const hex = coerceString(
        entry.hex_code ?? entry.hexCode ?? entry.hex_value ?? entry.hex
      );

      if (!hex) {
        return null;
      }

      const name: string =
        coerceString(entry.color_name ?? entry.name ?? entry.label) ?? hex;

      const paletteEntry: VisualPaletteEntryViewModel = {
        name,
        hex,
        usageNotes: coerceString(
          entry.usage_notes ?? entry.notes ?? entry.description ?? entry.detail
        ),
      };

      return paletteEntry;
    })
    .filter((entry): entry is VisualPaletteEntryViewModel => Boolean(entry));

  if (!visualStyleName && !visualStyleDescription && palette.length === 0) {
    return null;
  }

  return {
    visualStyleName,
    visualStyleDescription,
    palette,
  };
}

function parseCharacterDesigns(record: UnknownRecord): VisualCharacterSummary[] {
  const candidates =
    (record.character_designs ?? record.characterDesigns) ?? [];
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const detailed =
        getRecord(entry, "detailed_description", "detailedDescription") ??
        null;

      const id =
        coerceString(
          entry.character_id ??
            entry.characterId ??
            entry.character_name ??
            entry.characterName
        ) ?? undefined;

      if (!id) {
        return null;
      }

      const imagePath = normalizeStoragePath(
        entry.character_model_sheet_image_path ??
          entry.characterModelSheetImagePath ??
          entry.model_sheet_image_path
      );

      const attire = coerceString(
        detailed?.attire ?? detailed?.wardrobe ?? detailed?.costume
      );
      const physique = coerceString(
        detailed?.physique ?? detailed?.silhouette ?? detailed?.build
      );
      const facialFeatures = coerceString(
        detailed?.facial_features ??
          detailed?.face ??
          detailed?.notable_features ??
          detailed?.facialFeatures
      );

      const description = coerceString(
        detailed?.overall_description ??
          detailed?.summary ??
          detailed?.character_summary ??
          entry.description ??
          entry.character_summary
      );

      const name =
        coerceString(entry.character_name ?? entry.characterName) ?? id;
      const sceneletIds = coerceStringArray(
        entry.associated_scenelet_ids ??
          entry.associatedSceneletIds ??
          entry.scenelets
      );

      const summary: VisualCharacterSummary = {
        id,
        name,
        role: coerceString(entry.role ?? entry.character_role),
        description,
        attire,
        physique,
        facialFeatures,
        imagePath,
        sceneletIds,
      };

      return summary;
    })
    .filter((entry): entry is VisualCharacterSummary => Boolean(entry));
}

function parseEnvironmentDesigns(
  record: UnknownRecord
): VisualEnvironmentSummary[] {
  const candidates =
    (record.environment_designs ?? record.environmentDesigns) ?? [];
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const detailed =
        getRecord(entry, "detailed_description", "detailedDescription") ??
        null;

      const id =
        coerceString(
          entry.environment_id ??
            entry.environmentId ??
            entry.environment_name ??
            entry.environmentName
        ) ?? undefined;

      if (!id) {
        return null;
      }

      const referenceImagePath = normalizeStoragePath(
        entry.environment_reference_image_path ??
          entry.environmentReferenceImagePath ??
          entry.reference_image_path
      );

      const overallDescription = coerceString(
        detailed?.overall_description ??
          detailed?.overview ??
          detailed?.summary ??
          entry.description
      );

      const lighting = coerceString(
        detailed?.lighting_and_atmosphere ??
          detailed?.lighting ??
          detailed?.atmosphere
      );

      const colorTones = joinList(
        detailed?.color_tones ??
          detailed?.color_palette ??
          detailed?.palette ??
          entry.color_tones
      );

      const keyElements = joinList(
        detailed?.key_elements ??
          detailed?.key_props ??
          detailed?.key_elements_notes ??
          entry.key_elements
      );

      const name =
        coerceString(entry.environment_name ?? entry.environmentName) ?? id;

      const sceneletIds = coerceStringArray(
        entry.associated_scenelet_ids ??
          entry.associatedSceneletIds ??
          entry.scenelets
      );

      const summary: VisualEnvironmentSummary = {
        id,
        name,
        overallDescription,
        lighting,
        colorTones,
        keyElements,
        sceneletIds,
        referenceImagePath,
      };

      return summary;
    })
    .filter((entry): entry is VisualEnvironmentSummary => Boolean(entry));
}

export function parseVisualDesignDocument(
  data: unknown
): VisualDesignDocumentResult | null {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return parseVisualDesignDocument(parsed);
    } catch {
      return null;
    }
  }

  if (!isRecord(data)) {
    return null;
  }

  const globalAesthetic = parseGlobalAesthetic(data);
  const characters = parseCharacterDesigns(data);
  const environments = parseEnvironmentDesigns(data);

  if (!globalAesthetic && characters.length === 0 && environments.length === 0) {
    return null;
  }

  return {
    globalAesthetic,
    characters,
    environments,
    raw: data,
  };
}
