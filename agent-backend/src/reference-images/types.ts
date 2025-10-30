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
}

export interface ReferenceImageRecommenderOptions {
  validateFileExistence?: boolean;
}
