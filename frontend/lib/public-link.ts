export function campaignSlugFromPath(path: string): string {
  const separator = path.lastIndexOf("~");
  return separator === -1 ? path : path.slice(separator + 1);
}

export function buildPublicSurveyUrl(workspaceSlug: string, publicPath: string): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain) return `https://${workspaceSlug}.${rootDomain}/${publicPath}`;
  return `/respond/${publicPath}`;
}
