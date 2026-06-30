/** Parse comma-separated env values into a trimmed, non-empty string array. */
export function parseCsvEnv(
  value: string | undefined,
  fallback: readonly string[],
): string[] {
  const raw = value?.trim();
  if (!raw) {
    return [...fallback];
  }
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...fallback];
}
