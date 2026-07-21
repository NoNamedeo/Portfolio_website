import {
  GetAboutPage,
  GetCatalogClientData,
  GetCatalogItemPage,
  GetCatalogPage,
  GetHomePage,
  GetPublishedCatalogItemSlugs,
  GetStaticPage,
  QueryCatalog
} from '@application/use-cases/catalog-use-cases';
import {
  AddItemToCart,
  ClearCart,
  GetCart,
  RemoveItemFromCart,
  SetDonationAmount,
  UpdateCartItemNotes,
  UpdateCartItemQuantity
} from '@application/use-cases/cart-use-cases';
import { StartCheckout } from '@application/use-cases/checkout-use-cases';
import { AstroContentCatalogRepository } from '@infrastructure/content/astro-content-catalog-repository';
import { AstroContentProfileRepository } from '@infrastructure/content/astro-content-profile-repository';
import { ConfigurationSiteIdentityRepository } from '@infrastructure/configuration/configuration-site-identity-repository';
import { LocalStorageCartRepository } from '@infrastructure/persistence/local-storage-cart-repository';

export const createCompositionRoot = () => {
  const catalogRepository = new AstroContentCatalogRepository();
  const profileRepository = new AstroContentProfileRepository();
  const identityRepository = new ConfigurationSiteIdentityRepository();
  const cartRepository = new LocalStorageCartRepository();

  return {
    getHomePage: new GetHomePage(catalogRepository, identityRepository),
    getCatalogPage: new GetCatalogPage(catalogRepository, identityRepository),
    getCatalogItemPage: new GetCatalogItemPage(catalogRepository, identityRepository),
    queryCatalog: new QueryCatalog(catalogRepository),
    getPublishedCatalogItemSlugs: new GetPublishedCatalogItemSlugs(catalogRepository),
    getCatalogClientData: new GetCatalogClientData(catalogRepository),
    getAboutPage: new GetAboutPage(profileRepository, identityRepository),
    getStaticPage: new GetStaticPage(identityRepository),
    getCart: new GetCart(cartRepository, catalogRepository, identityRepository),
    addItemToCart: new AddItemToCart(cartRepository, catalogRepository),
    removeItemFromCart: new RemoveItemFromCart(cartRepository, catalogRepository),
    updateCartItemQuantity: new UpdateCartItemQuantity(cartRepository, catalogRepository),
    setDonationAmount: new SetDonationAmount(cartRepository, catalogRepository),
    updateCartItemNotes: new UpdateCartItemNotes(cartRepository, catalogRepository),
    clearCart: new ClearCart(cartRepository),
    startCheckout: new StartCheckout(cartRepository, catalogRepository, identityRepository)
  } as const;
};
