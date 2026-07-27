import type {
  AcquisitionMode,
  CatalogItemProps,
  CatalogItemType,
  CatalogMedia
} from '@core/domain/catalog/catalog-item';
import type { PricingKind } from '@core/domain/catalog/pricing';

export interface SeoModel {
  readonly siteName: string;
  readonly locale: string;
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly image: string;
  readonly type: 'website' | 'article';
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

export interface SiteShellModel {
  readonly name: string;
  readonly tagline: string;
  readonly locale: string;
  readonly seo: SeoModel;
}

export interface CatalogItemCardModel {
  readonly id: string;
  readonly slug: string;
  readonly type: CatalogItemType;
  readonly typeLabel: string;
  readonly title: string;
  readonly shortDescription: string;
  readonly year: number;
  readonly featured: boolean;
  readonly order: number;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly technologies: readonly string[];
  readonly media: CatalogMedia;
  readonly pricingKind: PricingKind;
  readonly pricingLabel: string;
  readonly acquisitionMode: AcquisitionMode;
  readonly acquisitionLabel: string;
  readonly availabilityLabel: string;
  readonly canAddToCart: boolean;
  readonly searchText: string;
  readonly themeKey: string;
  readonly experienceKey: string;
}

export interface HomePageModel extends SiteShellModel {
  readonly introduction: string;
  readonly featuredItems: readonly CatalogItemCardModel[];
}

export interface CatalogPageModel extends SiteShellModel {
  readonly items: readonly CatalogItemCardModel[];
  readonly categories: readonly string[];
  readonly categorySummaries: readonly { readonly name: string; readonly count: number }[];
  readonly types: readonly { readonly value: CatalogItemType; readonly label: string }[];
  readonly resultCount: number;
}

export interface CatalogItemPageModel extends SiteShellModel {
  readonly contentId: string;
  readonly item: CatalogItemCardModel & {
    readonly links: readonly { readonly label: string; readonly href: string }[];
    readonly transitionKey: string;
    readonly layoutKey: string;
  };
  readonly relatedItems: readonly CatalogItemCardModel[];
  readonly previous?: CatalogItemCardModel;
  readonly next?: CatalogItemCardModel;
}

export interface CartLineModel {
  readonly catalogItemId: string;
  readonly title: string;
  readonly slug: string;
  readonly quantity: number;
  readonly pricingLabel: string;
  readonly selectedAmount?: string;
  readonly notes?: string;
}

export interface CartPageModel extends SiteShellModel {
  readonly lines: readonly CartLineModel[];
  readonly itemCount: number;
  readonly totalLabel: string | null;
  readonly knownTotalLabel: string;
  readonly hasQuote: boolean;
  readonly hasDonation: boolean;
  readonly hasCurrencyConflict: boolean;
}

export interface CheckoutPageModel extends SiteShellModel {
  readonly cart: CartPageModel;
  readonly formName: string;
}

export type CatalogClientItemModel = CatalogItemProps;
