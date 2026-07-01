/** Canonical RFC 4122 UUID pattern (versions 1-5) used across the backend. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuid(value: string, fieldName: string): void {
  if (!isUuid(value)) {
    throw new Error(`${fieldName} must be a UUID`);
  }
}
