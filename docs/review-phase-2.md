# Revisione architetturale — fase 2

Data: 21 luglio 2026

## Obiettivo e perimetro

La revisione ha verificato architettura, dominio, application layer, adapter, integrazione client,
contenuti, persistenza, test, accessibilità, SEO, performance, tooling e documentazione. Non ha
introdotto redesign, animazioni, GSAP, Three.js, audio, CMS, pagamenti o nuove funzionalità di
prodotto.

Il baseline è stato eseguito prima delle modifiche con installazione frozen, format check, Astro e
TypeScript, ESLint, Vitest, build ed E2E. Il baseline era verde: 32 test Vitest, 4 test Playwright e
13 pagine statiche.

L’analisi delle dipendenze iniziale ha rilevato 73 moduli sorgente, 180 import interni e nessun ciclo.
Il problema principale non era quindi una dipendenza circolare, ma l’erosione di alcuni confini e
la presenza di regole duplicate o non protette a runtime.

## Problemi trovati e risolti

| Severità | Problema                                                                                               | Soluzione applicata                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Alta     | Le righe salvate potevano riferirsi a contenuti rimossi, in bozza o non più acquisibili.               | `GetCartState` riconcilia e persiste il carrello prima di letture e mutazioni.                                            |
| Alta     | Totali e donazioni assumevano implicitamente EUR; valute miste potevano produrre risultati incoerenti. | Totali a valuta singola, rilevamento conflitti, blocco combinazioni e checkout, valuta donazione inferita dal carrello.   |
| Alta     | Era possibile associare un importo di donazione a una riga non-donazione.                              | Invariante spostato in `Cart.setDonationAmount` con articolo e catalogo correnti.                                         |
| Alta     | Nessuna CI impediva regressioni su typecheck, lint, test, build ed E2E.                                | Aggiunta workflow GitHub Actions completa e riproducibile.                                                                |
| Media    | Il client presentation importava adapter infrastructure concreti.                                      | Introdotta `client-composition-root.ts`; ESLint vieta nuove dipendenze presentation → infrastructure.                     |
| Media    | Ricerca, filtri e sort erano duplicati nel DOM e divergevano dal dominio.                              | Introdotta query combinata `Catalog.query` e riuso tramite `QueryCatalog`; il DOM usa ID stabili.                         |
| Media    | Il frontmatter SEO delle schede veniva validato ma ignorato.                                           | `CatalogItem` conserva SEO e `GetCatalogItemPage` lo usa nei metadati.                                                    |
| Media    | Il formato local storage non distingueva corruzione, migrazione e versioni future.                     | Restore con stato, migrazione `v0 → v1`, rimozione dei dati corrotti e conservazione prudente di versioni non supportate. |
| Media    | Il catalogo HTTP si fidava dei tipi TypeScript dopo `JSON.parse`.                                      | Ricostruzione tramite entità con validazione runtime di discriminanti, denaro, liste, media, link, SEO e ArtDirection.    |
| Media    | Il profilo era scelto come “prima entry” della collection.                                             | Lettura deterministica dell’entry `profile/main`.                                                                         |
| Media    | Le route dinamiche duplicavano la regola “pubblicato”.                                                 | `getStaticPaths` usa `GetPublishedCatalogItemSlugs`.                                                                      |
| Media    | Dominio canonico duplicato fra Astro e repository di configurazione.                                   | Aggiunta fonte unica `site.config.json`.                                                                                  |
| Bassa    | Porte e gateway mock senza un flusso reale aumentavano superficie e debito.                            | Rimossi gateway e use case pass-through; le future astrazioni nasceranno da requisiti concreti.                           |
| Bassa    | `PortfolioStore` era una root anemica inutilizzata.                                                    | Rimossa la classe; Portfolio Store resta il nome concettuale del sistema.                                                 |
| Bassa    | Header cache Netlify puntava a `/assets/*`, ma Astro emette `/_astro/*`.                               | Corretto il pattern degli asset immutabili.                                                                               |
| Bassa    | JSON-LD non neutralizzava il carattere `<`.                                                            | Serializzazione difensiva prima di `set:html`.                                                                            |
| Bassa    | Il client non era esplicitamente idempotente e gestiva in modo fragile errori/storage.                 | Guard di inizializzazione, error boundary applicativo, annunci live e accessi storage protetti.                           |

## Architettura risultante

Il dominio rimane indipendente dalla piattaforma. L’application layer orchestra porte e regole; gli
adapter Astro, HTTP, configurazione e storage implementano i confini esterni. Due composition root
separano il wiring build/server da quello browser.

Le regole di dipendenza sono ora verificabili da ESLint:

- domain non può importare application, infrastructure, presentation, app o Astro;
- application non può importare infrastructure, presentation, app o Astro;
- presentation non può importare infrastructure.

Non è stato aggiunto un framework di dependency injection. Per la dimensione attuale, costruzione
manuale e alias tipizzati sono più leggibili e sufficienti.

## Correttezza del dominio

Gli invarianti coperti includono:

- ID e slug validi e univoci;
- discriminanti catalogo e pricing validati a runtime;
- contenuti pubblicati esclusi da ricerca e route quando in bozza/archivio;
- coerenza donazione/prezzo/modalità di acquisizione;
- `Money` non negativo, safe integer e con valuta supportata;
- nessuna conversione implicita fra valute;
- quantità carrello 1–99, righe univoche, note limitate e donazione minima;
- restore versionato, migrazione legacy e riconciliazione con il catalogo;
- email, nome, azienda, intervalli mensili e date di calendario validi;
- checkout pronto solo con cliente, consenso, carrello non vuoto e dettagli.

## Contenuti e adapter

Le Content Collections applicano limiti, regex, liste univoche, URL sicuri, dimensioni media,
metadati SEO e forme discriminate del prezzo. L’adapter converte poi i dati in oggetti di dominio:
lo schema editoriale e il dominio sono due difese complementari, non alternative.

`HttpCatalogRepository` valida lo stesso modello nel browser, conserva una cache per istanza e
azzera la cache su errore per permettere un retry. `LocalStorageCartRepository` è SSR-safe,
iniettabile nei test e traduce gli errori del browser in `ApplicationError` tipizzati.

## Accessibilità, SEO e performance

Verifiche eseguite sul markup e sulla build:

- landmark, skip link, focus visibile, controlli nativi, label, regioni live e reduced motion;
- link checkout realmente escluso dal tab order quando non utilizzabile;
- feedback accessibile per successi, errori e riconciliazione;
- un `h1` per flusso principale, immagini con alt e dimensioni dichiarate;
- title, description, canonical, Open Graph, locale, site name, Twitter Card e JSON-LD;
- sitemap, robots e vere risposte 404 per schede inesistenti;
- prima immagine editoriale della home eager/high priority, resto lazy;
- fetch del catalogo riservato a catalogo, carrello e checkout;
- output statico, nessun font remoto o script third-party;
- cache immutabile corretta per `/_astro/*`.

La build verificata genera 13 pagine. Il bundle client principale è 25,7 kB raw / 8,1 kB gzip e il
CSS globale 13,7 kB raw / 3,6 kB gzip, entrambi inferiori ai budget documentati. Questa verifica non
sostituisce misure RUM o Lighthouse su rete e hardware rappresentativi.

## Test e quality gate

La copertura è stata ampliata su:

- value object, catalogo, query combinate e invarianti runtime;
- carrello, valute, righe stale, serializzazione e migrazione;
- CheckoutDraft e dati cliente;
- repository HTTP, cache/retry e local storage;
- filtri reali nel browser, persistenza carrello, checkout, campi sensibili assenti, route 404 e
  assenza di errori client critici.

La CI esegue format, check, lint, test, build, installazione Chromium ed E2E con un worker in ambiente
CI. Il report Playwright viene conservato come artifact anche in caso di fallimento.

Quality gate finale locale: installazione frozen, format check, Astro/TypeScript, lint, 51 test
Vitest, build di 13 pagine e 8 test Playwright tutti completati con successo.

## Decisioni rinviate intenzionalmente

- redesign e art direction definitiva;
- animazioni, transizioni avanzate e creative engine;
- integrazioni server-side, pagamenti e donazioni reali;
- CMS e autenticazione;
- analytics e consenso;
- visual regression e matrice completa Chromium/Firefox/WebKit;
- Lighthouse CI e monitoraggio Core Web Vitals;
- invio reale del form, verificabile solo su un deploy Netlify configurato.

## Debito residuo e rischi

1. `site.config.json`, profilo, link esterni e contenuti sono dimostrativi: il dominio
   `portfolio.example.com` blocca una release pubblica corretta.
2. L’integrazione Netlify Forms è valida nel markup, ma deve essere provata end-to-end su un deploy.
3. La verifica accessibilità è strutturale e browser-based; manca ancora un audit WCAG 2.2 AA con
   tecnologie assistive e revisione manuale.
4. I test E2E automatici usano Chromium; gli altri engine restano un gate della fase visuale.
5. Il bundle client è piccolo ma condiviso da tutte le pagine; con future esperienze creative dovrà
   essere suddiviso per route e misurato.
6. Il corpo MDX viene renderizzato da un componente Astro dedicato. È un seam di framework
   intenzionale, ma non deve diventare un punto in cui inserire regole editoriali o di dominio.

## Raccomandazioni prima della fase successiva

1. Sostituire tutti i dati demo e configurare il canonical reale.
2. Eseguire un deploy preview Netlify e verificare ricezione, honeypot, redirect e trattamento dati.
3. Aggiungere audit axe/Lighthouse e test manuali tastiera, screen reader e zoom 200%.
4. Estendere Playwright a Firefox e WebKit prima di introdurre transizioni.
5. Aggiungere visual regression degli stati catalogo, carrello e form.
6. Definire una proposta visuale solo dopo aver mantenuto verdi gli stessi quality gate.
