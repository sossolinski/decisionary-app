type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure = { ok: false; error: string };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateJoinCode(raw: string): ValidationResult<string> {
  const value = raw.trim().toUpperCase();
  if (!value) return { ok: false, error: "Enter join code." };
  if (!/^[A-Z0-9-]{4,24}$/.test(value)) {
    return {
      ok: false,
      error: "Join code format is invalid (use 4-24 chars: A-Z, 0-9, -).",
    };
  }
  return { ok: true, value };
}

export function validateSessionTitle(raw: string): ValidationResult<string> {
  const value = raw.trim();
  if (value.length < 3) return { ok: false, error: "Session title must have at least 3 characters." };
  if (value.length > 80) return { ok: false, error: "Session title can be at most 80 characters." };
  return { ok: true, value };
}

export function validateMessagePayload(titleRaw: string, bodyRaw: string): ValidationResult<{
  title: string;
  body: string;
}> {
  const title = titleRaw.trim();
  const body = bodyRaw.trim();

  if (title.length < 3) return { ok: false, error: "Title must have at least 3 characters." };
  if (title.length > 120) return { ok: false, error: "Title can be at most 120 characters." };
  if (body.length < 3) return { ok: false, error: "Body must have at least 3 characters." };
  if (body.length > 5000) return { ok: false, error: "Body can be at most 5000 characters." };

  return { ok: true, value: { title, body } };
}

