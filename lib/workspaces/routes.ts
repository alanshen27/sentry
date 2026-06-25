/** URL path for a workspace command center. */
export function workspacePath(slug: string): string {
  return `/w/${encodeURIComponent(slug)}`;
}

export function parseWorkspaceSlug(pathname: string): string | null {
  const match = pathname.match(/^\/w\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function isWorkspaceRoute(pathname: string): boolean {
  return pathname.startsWith("/w/") && pathname !== "/w";
}
