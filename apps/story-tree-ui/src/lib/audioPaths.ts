export function buildGeneratedMusicPath(storyId: string, cueName: string): string | null {
  const normalizedStoryId = storyId.trim();
  if (!normalizedStoryId) {
    return null;
  }

  const sanitizedCueName = sanitizeCueFileName(cueName);
  if (!sanitizedCueName) {
    return null;
  }

  return `/generated/${normalizedStoryId}/music/${sanitizedCueName}.m4a`;
}

function sanitizeCueFileName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const sanitized = trimmed
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized;
}
