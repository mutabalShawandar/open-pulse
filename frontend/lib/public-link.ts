export function buildPublicSurveyUrl(clinicSlug: string, publicSlug: string): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain) return `https://${clinicSlug}.${rootDomain}/${publicSlug}`;
  return `/umfragen/${publicSlug}`;
}
