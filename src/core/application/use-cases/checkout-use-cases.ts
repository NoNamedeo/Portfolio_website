import { GetCart } from './cart-use-cases';
import { createSeoModel } from '@application/mappers/seo-mapper';
import type { CheckoutPageModel } from '@application/models/page-models';
import type {
  CartRepository,
  CatalogRepository,
  SiteIdentityRepository
} from '@application/ports/repositories';

export class StartCheckout {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly identityRepository: SiteIdentityRepository
  ) {}

  async execute(): Promise<CheckoutPageModel> {
    const cart = await new GetCart(
      this.cartRepository,
      this.catalogRepository,
      this.identityRepository
    ).execute();
    const identity = await this.identityRepository.getSiteIdentity();
    return {
      name: identity.name,
      tagline: identity.tagline,
      locale: identity.locale,
      seo: createSeoModel(identity, {
        title: 'Checkout',
        description: 'Invia i dettagli della tua richiesta. Nessun pagamento viene elaborato.',
        path: '/checkout/'
      }),
      cart,
      formName: 'portfolio-checkout'
    };
  }
}
