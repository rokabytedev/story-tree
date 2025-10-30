import { describe, expect, it } from 'vitest';

import { normalizeNameForPath } from '../src/image-generation/normalizeNameForPath.js';

describe('normalizeNameForPath', () => {
  it('converts names to lowercase kebab-case', () => {
    expect(normalizeNameForPath('Cosmo the Coder')).toBe('cosmo-the-coder');
  });

  it('handles punctuation, emoji, and excess whitespace', () => {
    expect(normalizeNameForPath("  Dr. O'Reilly ✨  ")).toBe('dr-o-reilly');
  });

  it('preserves unicode characters that are safe for paths', () => {
    expect(normalizeNameForPath('环境-1')).toBe('环境-1');
  });

  it('replaces disallowed characters with single hyphens', () => {
    expect(normalizeNameForPath('Character/Name__v2!!')).toBe('character-name-v2');
  });

  it('strips diacritics to keep filesystem-safe characters', () => {
    expect(normalizeNameForPath('Señor Jalapeño')).toBe('senor-jalapeno');
  });

  it('throws an error when the input is empty or whitespace', () => {
    expect(() => normalizeNameForPath('   ')).toThrowError('Name must contain at least one alphanumeric character.');
  });
});
