import { ConfigurationSiteIdentityRepository } from '@infrastructure/configuration/configuration-site-identity-repository';

export const prerender = true;

export async function GET(): Promise<Response> {
  const identity = await new ConfigurationSiteIdentityRepository().getSiteIdentity();
  const body = [
    'User-agent: *',
    'Allow: /',
    'Sitemap: ' + identity.canonicalUrl + '/sitemap-index.xml'
  ];
  return new Response(body.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
