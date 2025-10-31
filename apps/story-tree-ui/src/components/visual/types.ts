export interface VisualStyle {
  name: string;
  description: string;
}

export interface ColorPaletteEntry {
  hex_code: string;
  color_name: string;
  usage_notes: string;
}

export interface GlobalAesthetic {
  visual_style: VisualStyle;
  master_color_palette: ColorPaletteEntry[];
}

export interface CharacterDesign {
  role: string;
  character_id: string;
  detailed_description: {
    attire: string;
    physique: string;
    facial_features: string;
  };
}

export interface EnvironmentDesign {
  environment_id: string;
  environment_name?: string;
  detailed_description: {
    overall_description: string;
    lighting_and_atmosphere: string;
    color_tones: string;
    key_elements: string;
  };
  associated_scenelet_ids: string[];
  environment_reference_image_path?: string;
}

export interface VisualDesignDocument {
  global_aesthetic: GlobalAesthetic;
  character_designs: CharacterDesign[];
  environment_designs: EnvironmentDesign[];
}

export interface CharacterReferencePlate {
  type: string;
  plate_description: string;
  image_generation_prompt: string;
  image_path?: string;
}

export interface CharacterModelSheet {
  character_id: string;
  reference_plates: CharacterReferencePlate[];
}

export interface EnvironmentKeyframe {
  keyframe_description: string;
  image_generation_prompt: string;
  image_path?: string;
}

export interface EnvironmentKeyframes {
  environment_id: string;
  keyframes: EnvironmentKeyframe[];
}

export interface VisualReferencePackage {
  character_model_sheets: CharacterModelSheet[];
  environment_keyframes: EnvironmentKeyframes[];
}
