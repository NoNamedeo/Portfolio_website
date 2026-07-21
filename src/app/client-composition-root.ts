import { QueryCatalog } from '@application/use-cases/catalog-use-cases';
import {
  AddItemToCart,
  ClearCart,
  GetCartItemCount,
  GetCartState,
  RemoveItemFromCart,
  SetDonationAmount,
  UpdateCartItemNotes,
  UpdateCartItemQuantity
} from '@application/use-cases/cart-use-cases';
import { HttpCatalogRepository } from '@infrastructure/content/http-catalog-repository';
import {
  CART_STORAGE_KEY,
  LocalStorageCartRepository
} from '@infrastructure/persistence/local-storage-cart-repository';

export const createClientCompositionRoot = () => {
  const catalogRepository = new HttpCatalogRepository();
  const cartRepository = new LocalStorageCartRepository();

  return {
    cartStorageKey: CART_STORAGE_KEY,
    getCartItemCount: new GetCartItemCount(cartRepository),
    getCartState: new GetCartState(cartRepository, catalogRepository),
    queryCatalog: new QueryCatalog(catalogRepository),
    addItemToCart: new AddItemToCart(cartRepository, catalogRepository),
    removeItemFromCart: new RemoveItemFromCart(cartRepository, catalogRepository),
    updateCartItemQuantity: new UpdateCartItemQuantity(cartRepository, catalogRepository),
    setDonationAmount: new SetDonationAmount(cartRepository, catalogRepository),
    updateCartItemNotes: new UpdateCartItemNotes(cartRepository, catalogRepository),
    clearCart: new ClearCart(cartRepository)
  } as const;
};
