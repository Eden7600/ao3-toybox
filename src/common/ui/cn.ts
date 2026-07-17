export type ClassValue = string | false | null | undefined;

/** Join conditional class fragments, skipping falsy entries. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
