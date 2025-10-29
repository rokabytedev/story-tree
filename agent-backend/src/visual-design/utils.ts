/**
 * Normalizes a character or environment name to a slug-style ID.
 * Converts to lowercase, removes special characters, and replaces spaces with hyphens.
 *
 * Examples:
 * - "Cosmo's Jungle Workshop" → "cosmos-jungle-workshop"
 * - "Rhea the Explorer" → "rhea-the-explorer"
 * - "NARRATOR" → "narrator"
 *
 * @param name The original character or environment name
 * @returns A normalized slug-style ID
 */
export function normalizeNameToId(name: string): string {
  return name
    .toLowerCase()
    // Remove apostrophes and quotes
    .replace(/['"`]/g, '')
    // Replace any non-alphanumeric characters (except hyphens) with spaces
    .replace(/[^a-z0-9\s-]/g, ' ')
    // Replace multiple spaces or hyphens with a single hyphen
    .replace(/[\s-]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}
