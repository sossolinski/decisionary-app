export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function logClientError(context: string, error: unknown) {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[${context}]`, error);
}
