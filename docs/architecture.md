# Architettura

## Confine concettuale

**Portfolio Store** è il nome del sistema e della metafora, non una classe coordinatrice. Identità,
profilo e catalogo hanno cicli di vita distinti; `Cart` e `CheckoutDraft` sono aggregate autonomi.
Non esiste quindi una finta root anemica che raccolga oggetti senza proteggere invarianti.

```text
SiteIdentity        Profile → Resume

Catalog → CatalogItem[]

Cart → CartLine[]

CheckoutDraft → Cart + CustomerInformation
```

## Strati e direzione delle dipendenze

```text
Presentation ──usa──> Application ──usa──> Domain
       │                  ▲
       └──usa Domain      │ implementa porte
                          │
                    Infrastructure

App composition roots ──costruiscono──> casi d’uso + adapter
Experience ──legge──> hook semantici della Presentation
```

Le dipendenze puntano verso le regole più stabili. Il dominio non conosce Astro, DOM,
`localStorage`, CSS o Netlify. L’application layer non importa adapter concreti. La presentation
client ottiene le dipendenze da una composition root e non costruisce infrastructure direttamente.
Queste regole sono anche codificate in ESLint.

## Responsabilità

- `src/core/domain`: entità, value object e invarianti indipendenti dalla piattaforma;
- `src/core/application`: casi d’uso, porte, mapper e page model readonly;
- `src/infrastructure/content`: adapter Astro Content e repository HTTP del catalogo client;
- `src/infrastructure/persistence`: persistenza versionata del carrello;
- `src/infrastructure/configuration`: adapter dell’identità globale;
- `src/presentation`: HTML, componenti Astro e progressive enhancement client;
- `src/pages`: route statiche sottili;
- `src/experience`: lifecycle e preferenze di movimento, senza scene concrete;
- `src/app`: composition root server/build e client, messaggi e configurazione UI;
- `src/content`: contenuti MDX validati;
- `src/styles`: token, base, componenti e utility.

`site.config.json` è l’unica fonte per identità, locale, dominio canonico e social preview. Astro e
l’adapter di configurazione leggono lo stesso file per evitare canonical divergenti.

## Modello di dominio

### CatalogItem e Catalog

`CatalogItemId` resta stabile anche se cambia lo slug. `CatalogItem` valida a runtime discriminanti,
testi, media, liste, link, SEO, acquisibilità e coerenza fra prezzo e modalità di acquisizione.
Questo è necessario anche nel browser, dove le entità vengono ricostruite da JSON.

`Catalog` protegge unicità di ID e slug e centralizza pubblicazione, query combinata, ordinamento,
correlati e navigazione adiacente. Ricerca, filtro e sort nel browser usano lo stesso metodo
`query` del dominio.

### Money, Pricing, Cart e CartLine

`Money` usa unità minori intere e valute esplicite (`EUR`, `USD`, `GBP`); non effettua conversioni.
`Pricing` è discriminato e verifica a runtime quando un importo è richiesto o vietato.

`Cart` produce nuove istanze per ogni mutazione, impedisce righe duplicate, applica quantità da 1 a
99, note e donazioni minime, rileva valute incompatibili e calcola totali solo quando semanticamente
possibile. `reconcile` elimina righe non più pubblicate o acquisibili. Il formato persistito ha una
versione esplicita e una migrazione dal formato legacy `v0` a `v1`.

### Checkout e profilo

`CheckoutDraft` coordina carrello, cliente, budget, data di calendario, dettagli e consenso.
`EmailAddress`, `CustomerInformation` e `DateRange` proteggono i rispettivi invarianti. I dati
editoriali del profilo sono inoltre vincolati alla frontiera dalla Content Collection.

### ArtDirection

Contiene solo chiavi semantiche validate per tema, esperienza, transizione e layout. Non contiene
implementazioni di animazione.

## Porte e adapter

Porte applicative:

- `CatalogRepository`;
- `ProfileRepository`;
- `SiteIdentityRepository`;
- `CartRepository`.

Adapter concreti:

- `AstroContentCatalogRepository`;
- `AstroContentProfileRepository`;
- `HttpCatalogRepository`;
- `ConfigurationSiteIdentityRepository`;
- `LocalStorageCartRepository`.

Non esistono gateway mock per pagamenti o invii futuri: un’astrazione viene introdotta solo quando
esiste un caso d’uso reale. L’integrazione attuale con Netlify Forms è HTML nativo.

## Casi d’uso

Catalogo e pagine:

- `GetHomePage`, `GetCatalogPage`, `GetCatalogItemPage`;
- `QueryCatalog`, `GetPublishedCatalogItemSlugs`, `GetCatalogClientData`;
- `GetAboutPage`, `GetStaticPage`.

Carrello:

- `GetCartItemCount`, `GetCartState`, `GetCart`;
- `AddItemToCart`, `RemoveItemFromCart`, `UpdateCartItemQuantity`;
- `UpdateCartItemNotes`, `SetDonationAmount`, `ClearCart`.

Checkout:

- `StartCheckout`.

I casi d’uso restituiscono page model readonly per il rendering oppure oggetti di dominio quando il
client deve applicare ulteriori regole. Le pagine non sono entità: sono proiezioni temporanee per un
canale di presentazione.

## Composition root

`src/app/composition-root.ts` cabla route/build e Content Collections.
`src/app/client-composition-root.ts` cabla repository HTTP, storage browser e casi d’uso client.
Non c’è un container di dependency injection: il wiring rimane esplicito e sostituibile nei test.

## Flussi principali

```text
Homepage/catalogo
route Astro → use case → CatalogRepository → Domain → PageModel → componenti

Scheda
getStaticPaths → slugs pubblicati → GetCatalogItemPage → PageModel + render MDX

Interazione catalogo
controlli → QueryCatalog → HttpCatalogRepository → Catalog.query → DOM esistente

Carrello
azione → use case → Cart → LocalStorageCartRepository
       → portfolio:cart-changed → indicatori/pagina/checkout

Checkout
StartCheckout → form Netlify statico
              → riepilogo locale serializzato → POST /order-confirmation/
```

Il repository HTTP mantiene una cache per istanza e riprova dopo errori. `GetCartState` riconcilia
lo storage con il catalogo corrente prima di ogni mutazione. Durante build/SSR il repository storage
ritorna un carrello vuoto perché il browser non è disponibile.

## Experience layer

`Experience` definisce `mount`, `play`, `pause`, `resize` e `destroy`.
`MotionPreferences` rispetta `prefers-reduced-motion`. Gli attributi `data-page`, `data-theme`,
`data-experience`, `data-transition` e `data-animate` sono hook stabili; non sono state introdotte
scene, transizioni complesse o librerie creative in questa fase.
