/** Join class names, dropping falsy entries. Small enough not to warrant a dependency. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
