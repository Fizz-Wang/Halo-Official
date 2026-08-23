export function normalizeInternalPath(value: string) {
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

export function isPublicLinkActive(
  _href: string | undefined,
  active: boolean | undefined,
) {
  return active !== false;
}
