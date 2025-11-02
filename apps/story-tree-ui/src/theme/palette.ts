export const storybookPalette = {
  page: "#f0ead2",
  surface: "#dde5b6",
  surfaceMuted: "#adc178",
  surfaceElevated: "#f7f3df",
  border: "#a98467",
  highlight: "#6c584c",
  accentMuted: "#d8c3b1",
  textPrimary: "#3b341f",
  textMuted: "#6f6042",
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
