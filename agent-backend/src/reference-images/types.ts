import type { VisualDesignDocument } from '../visual-design/types.js';

export interface ReferenceImageRecommendation {
  type: 'CHARACTER' | 'ENVIRONMENT';
  id: string;
  path: string;
  description: string;
}

export interface ReferenceImageRecommenderInput {
  storyId: string;
  referencedDesigns?: {
    characters: string[];
    environments: string[];
  };
  basePublicPath?: string;
  maxImages?: number;
  /**
   * Optional visual design document containing character and environment metadata.
   * When provided, image paths are read from the document instead of constructed from patterns.
   */
  visualDesignDocument?: VisualDesignDocument | string | null;
}

export interface ReferenceImageRecommenderOptions {
  validateFileExistence?: boolean;
}
