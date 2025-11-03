export const storybookPalette = {
  page: "#fefae0",
  surface: "#faedcd",
  surfaceMuted: "#e9edc9",
  surfaceElevated: "#fefbe6",
  border: "#dfb98e",
  highlight: "#d4a373",
  accentMuted: "#ccd5ae",
  textPrimary: "#755a3f",
  textMuted: "#947251",
} as const;

export type StorybookPaletteToken = keyof typeof storybookPalette;

export const storybookPaletteCssVariables: Record<StorybookPaletteToken, string> = {
  page: "var(--color-page)",
  surface: "var(--color-surface)",
  surfaceMuted: "var(--color-surface-muted)",
  surfaceElevated: "var(--color-surface-elevated)",
  border: "var(--color-border)",
  highlight: "var(--color-highlight)",
  accentMuted: "var(--color-accent-muted)",
  textPrimary: "var(--color-text-primary)",
  textMuted: "var(--color-text-muted)",
};
