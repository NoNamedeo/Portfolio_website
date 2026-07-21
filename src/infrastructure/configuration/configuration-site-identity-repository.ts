import type { SiteIdentityRepository } from '@application/ports/repositories';
import { SiteIdentity } from '@core/domain/portfolio/site-identity';
import siteConfig from '../../../site.config.json';

export class ConfigurationSiteIdentityRepository implements SiteIdentityRepository {
  async getSiteIdentity(): Promise<SiteIdentity> {
    return new SiteIdentity(
      siteConfig.name,
      siteConfig.tagline,
      siteConfig.description,
      siteConfig.locale,
      siteConfig.canonicalUrl,
      siteConfig.socialPreview
    );
  }
}
