import type { SerializedCart } from '@core/domain/cart/cart';

export const CART_CHANGED_EVENT = 'portfolio:cart-changed';

export interface CartChangedDetail {
  readonly cart: SerializedCart;
  readonly totalItems: number;
  readonly message: string;
}

declare global {
  interface WindowEventMap {
    'portfolio:cart-changed': CustomEvent<CartChangedDetail>;
  }
}

export const dispatchCartChanged = (detail: CartChangedDetail): void => {
  window.dispatchEvent(new CustomEvent<CartChangedDetail>(CART_CHANGED_EVENT, { detail }));
};
