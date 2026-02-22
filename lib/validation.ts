export function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function assertValidJoinCode(code: string): void {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    throw new Error("Join code must be 4-12 uppercase letters or digits.");
  }
}

export function assertNonEmptyTrimmed(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${fieldName} is required.`);
  return normalized;
}
