const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g;
const DISALLOWED_PATH_CHARS_REGEX = /[^\p{L}\p{N}]+/gu;

export function normalizeNameForPath(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Name must contain at least one alphanumeric character.');
  }

  const asciiFriendly = trimmed.normalize('NFKD').replace(DIACRITIC_MARKS_REGEX, '');
  const lowerCased = asciiFriendly.toLowerCase();
  const sanitized = lowerCased.replace(DISALLOWED_PATH_CHARS_REGEX, '-');
  const collapsed = sanitized.replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (!collapsed) {
    throw new Error('Name must contain at least one alphanumeric character.');
  }

  return collapsed;
}
