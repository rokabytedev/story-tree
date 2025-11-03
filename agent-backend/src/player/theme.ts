import path from 'node:path';
import { writeFile } from 'node:fs/promises';

import { storybookPalette } from '../../../apps/story-tree-ui/src/theme/palette.js';

const PLAYER_THEME_FILENAME = 'player-theme.css';

export async function writePlayerThemeStyles(outputDir: string): Promise<string> {
  const targetPath = path.join(outputDir, PLAYER_THEME_FILENAME);
  const css = buildPlayerThemeCss();
  await writeFile(targetPath, css, 'utf-8');
  return targetPath;
}

function hexToRgba(hex: string, alpha: number): string {
  let normalized = hex.trim();
  if (!normalized) {
    return hex;
  }

  if (normalized.startsWith('#')) {
    normalized = normalized.slice(1);
  }

  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }

  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return hex;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildPlayerThemeCss(): string {
  const lines: string[] = [];
  lines.push(':root {');
  lines.push(`  --color-page: ${storybookPalette.page};`);
  lines.push(`  --color-surface: ${storybookPalette.surface};`);
  lines.push(`  --color-surface-muted: ${storybookPalette.surfaceMuted};`);
  lines.push(`  --color-surface-elevated: ${storybookPalette.surfaceElevated};`);
  lines.push(`  --color-border: ${storybookPalette.border};`);
  lines.push(`  --color-border-subtle: ${hexToRgba(storybookPalette.border, 0.6)};`);
  lines.push(`  --color-highlight: ${storybookPalette.highlight};`);
  lines.push(`  --color-accent-muted: ${storybookPalette.accentMuted};`);
  lines.push(`  --color-text-primary: ${storybookPalette.textPrimary};`);
  lines.push(`  --color-text-muted: ${storybookPalette.textMuted};`);
  lines.push(`  --font-sans-stack: "Inter", "Helvetica Neue", Arial, sans-serif;`);
  lines.push(`  --font-mono-stack: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;`);
  lines.push('}');
  lines.push('');
  lines.push('body {');
  lines.push('  background-color: var(--color-page);');
  lines.push('  color: var(--color-text-primary);');
  lines.push('  font-family: var(--font-sans-stack);');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function getPlayerThemeFilename(): string {
  return PLAYER_THEME_FILENAME;
}
