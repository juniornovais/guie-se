export function configuredSiteOrigin() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (!siteUrl) return renderUrl || undefined;

  const { hostname, origin } = new URL(siteUrl);
  const isLoopback = /^(localhost\.?|127\.[\d.]+|\[::1\])$/.test(hostname);
  return isLoopback && renderUrl ? renderUrl : origin;
}
