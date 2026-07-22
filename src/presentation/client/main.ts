import { createClientCompositionRoot } from '@app/client-composition-root';
import { messages } from '@app/config/messages';
import { formatPricingLabel } from '@application/mappers/catalog-item-mapper';
import type { CartState } from '@application/use-cases/cart-use-cases';
import type { Cart } from '@core/domain/cart/cart';
import type { CartLine } from '@core/domain/cart/cart-line';
import type { CatalogSort } from '@core/domain/catalog/catalog';
import type { CatalogItem, CatalogItemType } from '@core/domain/catalog/catalog-item';
import {
  ExperienceRegistry,
  MotionPreferences,
  type Experience
} from '@experience/core/experience';
import { CART_CHANGED_EVENT, dispatchCartChanged } from './cart-events';

const client = createClientCompositionRoot();
const experienceRegistry = new ExperienceRegistry();
experienceRegistry.register('home-showcase', async () => {
  const { HomeShowcaseExperience } = await import('@experience/home/home-showcase-experience');
  return new HomeShowcaseExperience();
});
experienceRegistry.register('catalog-showcase', async () => {
  const { CatalogShowcaseExperience } =
    await import('@experience/home/catalog-showcase-experience');
  return new CatalogShowcaseExperience();
});

let activeExperiences: Experience[] = [];
let experienceSetup: Promise<void> | undefined;
let experienceGeneration = 0;

const query = <ElementType extends Element>(selector: string): ElementType | null =>
  document.querySelector<ElementType>(selector);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Si è verificato un errore. Riprova.';

const announce = (message: string): void => {
  const region = query<HTMLElement>('[data-app-announcer]');
  if (region) region.textContent = message;
};

const refreshIndicators = (totalItems: number): void => {
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((indicator) => {
    indicator.textContent = String(totalItems);
  });
};

const emitCart = (cart: Cart, message: string): void => {
  dispatchCartChanged({ cart: cart.toJSON(), totalItems: cart.totalItems(), message });
};

const executeCartAction = async (
  action: () => Promise<Cart>,
  successMessage: string
): Promise<void> => {
  try {
    const cart = await action();
    emitCart(cart, successMessage);
  } catch (error) {
    announce(errorMessage(error));
    await updateClientViews();
  }
};

const makeText = (
  tagName: keyof HTMLElementTagNameMap,
  text: string,
  className?: string
): HTMLElement => {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
};

const makeField = (
  labelText: string,
  id: string,
  control: HTMLInputElement | HTMLTextAreaElement
): HTMLElement => {
  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  control.id = id;
  field.append(label, control);
  return field;
};

const renderCartLine = (item: CatalogItem, line: CartLine, cartCurrency: string): HTMLLIElement => {
  const row = document.createElement('li');
  row.className = 'cart-line';
  row.dataset.cartLine = item.id.value;

  const information = document.createElement('div');
  information.className = 'flow';
  information.style.setProperty('--flow-space', 'var(--space-xs)');
  information.append(makeText('p', formatPricingLabel(item.pricing), 'eyebrow'));
  const title = makeText('h2', '', 'cart-line__title');
  const link = document.createElement('a');
  link.href = '/catalog/' + item.slug.value + '/';
  link.textContent = item.title;
  title.append(link);
  information.append(title, makeText('p', item.shortDescription, 'muted'));

  const quantity = document.createElement('input');
  quantity.type = 'number';
  quantity.min = '1';
  quantity.max = '99';
  quantity.value = String(line.quantity);
  quantity.dataset.cartQuantity = '';

  const controls = document.createElement('div');
  controls.className = 'cart-line__controls';
  controls.append(makeField('Quantità', 'quantity-' + item.id.value, quantity));

  if (item.pricing.kind === 'donation') {
    const donation = document.createElement('input');
    donation.type = 'number';
    donation.min = '1';
    donation.step = '1';
    donation.inputMode = 'decimal';
    donation.value = line.selectedAmount ? String(line.selectedAmount.amountMinor / 100) : '';
    donation.placeholder = 'Importo';
    donation.dataset.cartDonation = '';
    controls.append(
      makeField(
        'Donazione (' + (line.selectedAmount?.currency ?? cartCurrency) + ')',
        'donation-' + item.id.value,
        donation
      )
    );
  }

  const notes = document.createElement('textarea');
  notes.value = line.notes;
  notes.maxLength = 500;
  notes.placeholder = 'Preferenze o note per questa voce';
  notes.dataset.cartNotes = '';
  controls.append(makeField('Note', 'notes-' + item.id.value, notes));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button button--quiet';
  remove.dataset.cartRemove = '';
  remove.textContent = 'Rimuovi';

  row.append(information, controls, remove);
  return row;
};

const renderCartPage = (state: CartState): void => {
  const root = query<HTMLElement>('[data-cart-page]');
  if (!root) return;
  const { cart, items } = state;
  const list = root.querySelector<HTMLElement>('[data-cart-lines]');
  const empty = root.querySelector<HTMLElement>('[data-cart-empty]');
  if (!list || !empty) return;

  list.replaceChildren();
  const cartCurrency = cart.currency(items) ?? 'EUR';
  for (const line of cart.lines()) {
    const item = items.find((candidate) => candidate.id.value === line.catalogItemId.value);
    if (item) list.append(renderCartLine(item, line, cartCurrency));
  }

  const isEmpty = cart.totalItems() === 0;
  const currencyConflict = cart.hasCurrencyConflict(items);
  list.hidden = isEmpty;
  empty.hidden = !isEmpty;
  const count = root.querySelector<HTMLElement>('[data-cart-summary-count]');
  const totalElement = root.querySelector<HTMLElement>('[data-cart-summary-total]');
  if (count) count.textContent = String(cart.totalItems());
  if (totalElement) {
    totalElement.textContent =
      cart.knownTotal(items)?.format() ?? (currencyConflict ? 'Valute incompatibili' : '—');
  }
  const quoteNote = root.querySelector<HTMLElement>('[data-cart-quote-note]');
  const donationNote = root.querySelector<HTMLElement>('[data-cart-donation-note]');
  const currencyNote = root.querySelector<HTMLElement>('[data-cart-currency-note]');
  if (quoteNote) quoteNote.hidden = !cart.hasQuote(items);
  if (donationNote) donationNote.hidden = !cart.hasDonation(items);
  if (currencyNote) currencyNote.hidden = !currencyConflict;
  root
    .querySelectorAll<HTMLElement>('[data-cart-clear], [data-cart-checkout]')
    .forEach((element) => {
      if (element instanceof HTMLButtonElement) element.disabled = isEmpty;
      if (element instanceof HTMLAnchorElement) {
        const disabled = isEmpty || currencyConflict;
        element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        element.tabIndex = disabled ? -1 : 0;
      }
    });
};

const renderCheckout = (state: CartState): void => {
  const summary = query<HTMLElement>('[data-checkout-summary]');
  if (!summary) return;
  const { cart, items } = state;
  const list = document.createElement('ul');
  list.className = 'flow';
  for (const line of cart.lines()) {
    const item = items.find((candidate) => candidate.id.value === line.catalogItemId.value);
    if (item) list.append(makeText('li', item.title + ' × ' + String(line.quantity)));
  }
  summary.replaceChildren(
    cart.totalItems() > 0 ? list : makeText('p', 'Il carrello è vuoto.', 'notice')
  );
  const total = query<HTMLElement>('[data-checkout-total]');
  if (total) {
    total.textContent =
      cart.knownTotal(items)?.format() ??
      (cart.hasCurrencyConflict(items) ? 'Valute incompatibili' : '—');
  }
  const serialized = query<HTMLInputElement>('[data-checkout-cart]');
  if (serialized) serialized.value = JSON.stringify(cart.toJSON());
  const submit = query<HTMLButtonElement>('[data-checkout-form] button[type="submit"]');
  if (submit) submit.disabled = cart.totalItems() === 0 || cart.hasCurrencyConflict(items);
};

const updateClientViews = async (): Promise<void> => {
  try {
    const needsCatalog = Boolean(query('[data-cart-page], [data-checkout-summary]'));
    if (!needsCatalog) {
      refreshIndicators(await client.getCartItemCount.execute());
      return;
    }
    const state = await client.getCartState.execute();
    refreshIndicators(state.cart.totalItems());
    renderCartPage(state);
    renderCheckout(state);
    if (state.removedItemIds.length > 0) {
      announce('Alcuni articoli non più disponibili sono stati rimossi dal carrello.');
    }
  } catch (error) {
    announce(errorMessage(error));
  }
};

const setupCartActions = (): void => {
  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const checkoutLink = target.closest<HTMLAnchorElement>('[data-cart-checkout]');
    if (checkoutLink?.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      announce('Aggiungi almeno un articolo valido prima di procedere al checkout.');
      return;
    }

    const add = target.closest<HTMLButtonElement>('[data-cart-add]');
    if (add) {
      const id = add.dataset.itemId;
      if (!id) return;
      add.disabled = true;
      await executeCartAction(() => client.addItemToCart.execute(id), messages.cart.added);
      add.disabled = false;
      return;
    }

    const line = target.closest<HTMLElement>('[data-cart-line]');
    const id = line?.dataset.cartLine;
    if (id && target.closest('[data-cart-remove]')) {
      await executeCartAction(() => client.removeItemFromCart.execute(id), messages.cart.removed);
      return;
    }

    if (target.closest('[data-cart-clear]')) {
      await executeCartAction(() => client.clearCart.execute(), 'Carrello svuotato.');
    }
  });

  document.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const id = target.closest<HTMLElement>('[data-cart-line]')?.dataset.cartLine;
    if (!id) return;
    if (target.matches('[data-cart-quantity]')) {
      await executeCartAction(
        () => client.updateCartItemQuantity.execute(id, Number(target.value)),
        'Quantità aggiornata.'
      );
    }
    if (target.matches('[data-cart-donation]')) {
      await executeCartAction(
        () => client.setDonationAmount.execute(id, Math.round(Number(target.value) * 100)),
        'Importo della donazione aggiornato.'
      );
    }
    if (target.matches('[data-cart-notes]')) {
      await executeCartAction(
        () => client.updateCartItemNotes.execute(id, target.value),
        'Note aggiornate.'
      );
    }
  });
};

const setupCatalogControls = (): void => {
  const controls = query<HTMLFormElement>('[data-catalog-controls]');
  const grid = query<HTMLElement>('[data-catalog-grid]');
  if (!controls || !grid) return;
  controls.addEventListener('submit', (event) => event.preventDefault());
  const entries = new Map(
    [...grid.querySelectorAll<HTMLElement>('[data-catalog-entry]')].flatMap((entry) =>
      entry.dataset.catalogEntry ? [[entry.dataset.catalogEntry, entry] as const] : []
    )
  );
  const search = controls.querySelector<HTMLInputElement>('[data-catalog-search]');
  const type = controls.querySelector<HTMLSelectElement>('[data-catalog-type]');
  const category = controls.querySelector<HTMLSelectElement>('[data-catalog-category]');
  const sort = controls.querySelector<HTMLSelectElement>('[data-catalog-sort]');
  const resultCount = query<HTMLElement>('[data-catalog-result-count]');
  const noResults = query<HTMLElement>('[data-catalog-no-results]');
  const parameters = new URLSearchParams(window.location.search);
  if (search && parameters.has('query')) search.value = parameters.get('query') ?? '';
  if (type && parameters.has('type')) type.value = parameters.get('type') ?? '';
  if (category && parameters.has('category')) category.value = parameters.get('category') ?? '';
  let requestSequence = 0;

  const update = async (): Promise<void> => {
    const sequence = ++requestSequence;
    try {
      const result = await client.queryCatalog.execute({
        ...(search?.value.trim() ? { search: search.value.trim() } : {}),
        ...(type?.value ? { type: type.value as CatalogItemType } : {}),
        ...(category?.value ? { category: category.value } : {}),
        sort: (sort?.value ?? 'manual') as CatalogSort
      });
      if (sequence !== requestSequence) return;
      const visibleIds = new Set(result.map((item) => item.id.value));
      for (const [id, entry] of entries) entry.hidden = !visibleIds.has(id);
      for (const item of result) {
        const entry = entries.get(item.id.value);
        if (entry) grid.append(entry);
      }
      if (resultCount) resultCount.textContent = String(result.length);
      if (noResults) noResults.hidden = result.length !== 0;
    } catch (error) {
      announce(errorMessage(error));
    }
  };

  controls.addEventListener('input', () => void update());
  controls.addEventListener('change', () => void update());
  void update();
};

const setupCheckout = (): void => {
  const form = query<HTMLFormElement>('[data-checkout-form]');
  form?.addEventListener('submit', () => {
    try {
      window.sessionStorage.setItem('portfolio-store:checkout-submitted', 'true');
    } catch {
      announce('La conferma locale non è disponibile, ma il modulo può essere inviato.');
    }
  });
  if (document.body.dataset.page !== 'order-confirmation') return;
  try {
    if (window.sessionStorage.getItem('portfolio-store:checkout-submitted') === 'true') {
      window.sessionStorage.removeItem('portfolio-store:checkout-submitted');
      void executeCartAction(
        () => client.clearCart.execute(),
        'Richiesta inviata. Il carrello è stato svuotato.'
      );
    }
  } catch {
    announce(
      'La richiesta è stata completata; non è stato possibile aggiornare il carrello locale.'
    );
  }
};

const setupPageExperience = (reducedMotion: boolean): Promise<void> => {
  if (activeExperiences.length > 0) return Promise.resolve();
  if (experienceSetup) return experienceSetup;
  const roots = [
    ...document.querySelectorAll<HTMLElement>('[data-page-experience][data-experience]')
  ];
  if (roots.length === 0) return Promise.resolve();
  const generation = ++experienceGeneration;

  experienceSetup = (async () => {
    const created = await Promise.all(
      roots.map(async (root): Promise<Experience | undefined> => {
        const key = root.dataset.experience;
        if (!key) return undefined;
        try {
          const experience = await experienceRegistry.create(key);
          if (!experience || generation !== experienceGeneration || !root.isConnected) return;
          await experience.mount({
            root,
            page: document.body.dataset.page ?? 'unknown',
            reducedMotion
          });
          if (generation !== experienceGeneration) {
            experience.destroy();
            return undefined;
          }
          return experience;
        } catch (error) {
          announce(errorMessage(error));
          return undefined;
        }
      })
    );
    try {
      const experiences = created.filter(
        (experience): experience is Experience => experience !== undefined
      );
      if (generation !== experienceGeneration) {
        experiences.forEach((experience) => experience.destroy());
        return;
      }
      activeExperiences = experiences;
      activeExperiences.forEach((experience) => experience.play());
    } finally {
      experienceSetup = undefined;
    }
  })();
  return experienceSetup;
};

const destroyPageExperience = (): void => {
  experienceGeneration += 1;
  activeExperiences.forEach((experience) => experience.destroy());
  activeExperiences = [];
};

const initialize = (): void => {
  if (document.documentElement.dataset.portfolioClient === 'ready') return;
  document.documentElement.dataset.portfolioClient = 'ready';
  const reducedMotion = new MotionPreferences().isReduced();
  document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  setupCatalogControls();
  setupCartActions();
  setupCheckout();
  void setupPageExperience(reducedMotion);
  void updateClientViews();

  window.addEventListener(CART_CHANGED_EVENT, (event) => {
    announce(event.detail.message);
    refreshIndicators(event.detail.totalItems);
    void updateClientViews();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === client.cartStorageKey) void updateClientViews();
  });
  window.addEventListener('pagehide', destroyPageExperience);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void setupPageExperience(new MotionPreferences().isReduced());
  });
};

initialize();
