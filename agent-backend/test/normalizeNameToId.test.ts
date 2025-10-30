import { describe, expect, it } from 'vitest';
import { normalizeNameToId } from '../src/visual-design/utils.js';

describe('normalizeNameToId', () => {
  it('converts basic names to lowercase with hyphens', () => {
    expect(normalizeNameToId('Rhea')).toBe('rhea');
    expect(normalizeNameToId('Choice Clearing')).toBe('choice-clearing');
    expect(normalizeNameToId('Testing Agent')).toBe('testing-agent');
  });

  it('removes apostrophes and quotes', () => {
    expect(normalizeNameToId("Cosmo's Jungle Workshop")).toBe('cosmos-jungle-workshop');
    expect(normalizeNameToId('Narrator"s Voice')).toBe('narrators-voice');
    expect(normalizeNameToId('The `Special` Place')).toBe('the-special-place');
  });

  it('handles multiple spaces and special characters', () => {
    expect(normalizeNameToId('Rhea   the    Explorer')).toBe('rhea-the-explorer');
    expect(normalizeNameToId('Level-1 @ Main Hub')).toBe('level-1-main-hub');
    expect(normalizeNameToId('Workshop#2 (Testing)')).toBe('workshop-2-testing');
  });

  it('removes leading and trailing hyphens', () => {
    expect(normalizeNameToId('---Name---')).toBe('name');
    expect(normalizeNameToId('   Spaced Name   ')).toBe('spaced-name');
  });

  it('handles uppercase names', () => {
    expect(normalizeNameToId('NARRATOR')).toBe('narrator');
    expect(normalizeNameToId('COSMO')).toBe('cosmo');
  });

  it('handles mixed case and special characters', () => {
    expect(normalizeNameToId("Rhea's Workshop @ Level 2")).toBe('rheas-workshop-level-2');
    expect(normalizeNameToId('The Explorer\'s "Safe Haven"')).toBe('the-explorers-safe-haven');
  });

  it('handles empty and edge cases', () => {
    expect(normalizeNameToId('')).toBe('');
    expect(normalizeNameToId('   ')).toBe('');
    expect(normalizeNameToId('---')).toBe('');
    expect(normalizeNameToId('123')).toBe('123');
  });

  it('preserves alphanumeric content', () => {
    expect(normalizeNameToId('Agent007')).toBe('agent007');
    expect(normalizeNameToId('Level 42')).toBe('level-42');
  });

  it('handles names that differ only in punctuation', () => {
    // These should normalize to the same ID
    const name1 = normalizeNameToId("Cosmo's Jungle Workshop");
    const name2 = normalizeNameToId('Cosmos Jungle Workshop');
    const name3 = normalizeNameToId('COSMOS JUNGLE WORKSHOP');

    // Should all normalize similarly (allowing for apostrophe removal)
    expect(name1).toBe('cosmos-jungle-workshop');
    expect(name2).toBe('cosmos-jungle-workshop');
    expect(name3).toBe('cosmos-jungle-workshop');
  });
});
