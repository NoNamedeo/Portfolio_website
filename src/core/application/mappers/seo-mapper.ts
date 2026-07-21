import type { SeoModel } from '@application/models/page-models';
import type { SiteIdentity } from '@core/domain/portfolio/site-identity';

export const createSeoModel = (
  identity: SiteIdentity,
  props: {
    readonly title?: string;
    readonly description?: string;
    readonly path?: string;
    readonly image?: string;
    readonly type?: SeoModel['type'];
    readonly jsonLd?: Readonly<Record<string, unknown>>;
  } = {}
): SeoModel => {
  const pageTitle = props.title ? props.title + ' — ' + identity.name : identity.name;
  return {
    siteName: identity.name,
    locale: identity.locale.replace('-', '_'),
    title: pageTitle,
    description: props.description ?? identity.description,
    canonical: new URL(props.path ?? '/', identity.canonicalUrl).toString(),
    image: new URL(props.image ?? identity.socialPreview, identity.canonicalUrl).toString(),
    type: props.type ?? 'website',
    ...(props.jsonLd ? { jsonLd: props.jsonLd } : {})
  };
};
