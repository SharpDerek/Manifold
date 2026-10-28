// Chromium canonicalizes document URLs (including the trailing slash on an
// HTTP origin). Compare the entire canonical URL, never just an origin/prefix.
export function matchesRendererDocument(
  actual: string,
  expected: string,
): boolean {
  try {
    return new URL(actual).href === new URL(expected).href;
  } catch {
    return false;
  }
}
