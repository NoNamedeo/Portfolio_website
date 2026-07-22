# Studio Prisma — Portfolio Store

Base architetturale di un portfolio personale che usa il linguaggio e la struttura di un
e-commerce. Progetti, conoscenze, attività, competenze e servizi sono articoli di un catalogo:
possono essere esplorati, filtrati e aggiunti a un carrello per inviare una richiesta.

L’acquisto è una metafora. La prima fase non elabora pagamenti, non raccoglie carte e non richiede
un backend per mostrare i contenuti.

## Stack

- Astro 7 con output completamente statico;
- TypeScript 6 in modalità strict;
- Astro Content Collections con contenuti MDX;
- CSS moderno, custom properties e cascade layers;
- TypeScript browser-native per catalogo e carrello;
- Vitest per test unitari e di integrazione;
- Playwright per flussi end-to-end;
- ESLint e Prettier;
- Netlify Forms e configurazione Netlify.

Le versioni risolte e riproducibili sono registrate in <code>pnpm-lock.yaml</code>.

## Requisiti

- Node.js 22.12 o successivo (Node 24 consigliato e configurato su Netlify);
- pnpm 11;
- Git.

## Installazione

```sh
pnpm install
pnpm dev
```

Il comando di sviluppo usa la modalità background prevista dal progetto. La gestione avviene con:

```sh
pnpm dev:status
pnpm dev:logs
pnpm dev:stop
```

Il sito viene servito normalmente su <http://localhost:4321>.

## Comandi

| Comando                        | Funzione                                    |
| ------------------------------ | ------------------------------------------- |
| <code>pnpm dev</code>          | Avvia Astro in background                   |
| <code>pnpm build</code>        | Genera il sito statico in <code>dist</code> |
| <code>pnpm preview</code>      | Anteprima della build                       |
| <code>pnpm check</code>        | Astro check e TypeScript strict             |
| <code>pnpm lint</code>         | Analisi ESLint                              |
| <code>pnpm format</code>       | Formattazione Prettier                      |
| <code>pnpm format:check</code> | Verifica della formattazione                |
| <code>pnpm test</code>         | Test unitari e di integrazione Vitest       |
| <code>pnpm test:watch</code>   | Vitest in modalità watch                    |
| <code>pnpm test:e2e</code>     | Flussi browser Playwright                   |

La prima esecuzione E2E può richiedere:

```sh
pnpm exec playwright install chromium
```

## Struttura

```text
src/
├── app/                    composition root e configurazione UI
├── content/                articoli MDX e profilo
├── core/
│   ├── domain/             regole di catalogo, carrello, checkout e profilo
│   └── application/        porte, page model, mapper e casi d’uso
├── experience/             lifecycle ed esperienze creative progressive
├── infrastructure/         Astro Content, HTTP, configurazione e storage
├── pages/                  route Astro statiche
├── presentation/           layout, componenti e unico entry point client
├── styles/                 reset, token, tipografia, componenti e utility
└── content.config.ts       schemi delle Content Collections
tests/
├── fixtures/
├── integration/
├── unit/
└── e2e/
docs/
├── architecture.md
├── review-phase-2.md
└── roadmap.md
```

La direzione delle dipendenze è:

```text
Presentation → Application → Domain
Infrastructure → Application ports + Domain
Experience → Presentation hooks + modelli applicativi
```

Il dominio non importa Astro, DOM, localStorage, CSS o Netlify.
ESLint rende eseguibili i vincoli principali fra layer; le composition root server e client sono
gli unici punti che conoscono gli adapter concreti.

## Aggiungere un articolo

1. Duplica un file in <code>src/content/catalog</code>.
2. Scegli un <code>catalogItemId</code> stabile e uno <code>slug</code> URL-safe univoco.
3. Compila tutti i campi del frontmatter. Lo schema è in
   <code>src/content.config.ts</code>.
4. Inserisci un media locale in <code>public/media</code>, dichiarando testo alternativo,
   larghezza e altezza.
5. Scrivi il contenuto esteso in MDX sotto il frontmatter.
6. Esegui <code>pnpm check</code> e <code>pnpm build</code>.

Le modalità prezzo disponibili sono: gratuito, fisso, a partire da, preventivo, donazione e non
applicabile. Le modalità di acquisizione sono: vetrina, commissione, contatto, donazione, download e
acquisto.

Per pubblicare la scheda imposta <code>status: published</code>. Le route vengono generate
automaticamente in fase di build.

## Profilo e curriculum

Il profilo dimostrativo è in <code>src/content/profile/main.mdx</code>. Il frontmatter contiene
biografia, contatti, social, hobby, esperienze, studi e competenze. I dati presenti sono placeholder
e devono essere sostituiti prima della pubblicazione.

## Carrello

Il carrello è un aggregate di dominio testabile senza browser. L’implementazione
<code>LocalStorageCartRepository</code> persiste soltanto un formato serializzato versionato:

- aggiunta e rimozione;
- quantità da 1 a 99;
- note per riga;
- importo scelto per future donazioni;
- totale noto;
- valute esplicite senza conversioni implicite;
- rilevamento di preventivi e donazioni;
- riconciliazione automatica degli articoli rimossi o non più acquisibili;
- migrazione del formato persistito legacy da <code>v0</code> a <code>v1</code>;
- sincronizzazione tra pagine e tab;
- contatore accessibile nell’header.

Le interazioni partono da <code>src/presentation/client/main.ts</code>. L’evento applicativo
<code>portfolio:cart-changed</code> è tipizzato in <code>cart-events.ts</code>.

Senza JavaScript il catalogo e tutte le schede restano leggibili e navigabili; la persistenza del
carrello richiede invece il browser.

## Checkout

Il checkout usa un form HTML compatibile con Netlify Forms:

- nome del form e honeypot antispam;
- riepilogo serializzato del carrello in un campo nascosto;
- nome, email, azienda opzionale, budget, scadenza, messaggio e dettagli;
- consenso esplicito;
- pagina di conferma.

Il form invia una richiesta e non elabora denaro. Non esistono gateway speculativi: adapter e porte
per pagamenti, donazioni o invii server-side verranno introdotti solo insieme a requisiti reali.

## SEO, accessibilità e performance

La base include metadata specifici, canonical, Open Graph, Twitter Card, JSON-LD, sitemap,
robots.txt e breadcrumb. Il layout usa landmark semantici, skip link, focus visibile, controlli
nativi, regioni live e supporto a <code>prefers-reduced-motion</code>.

Il progetto non include framework UI, font remoti, database o librerie di animazione. Tutte le
pagine di contenuto vengono generate staticamente.

## Quality gate e CI

La workflow <code>.github/workflows/ci.yml</code> esegue su push e pull request:

1. installazione riproducibile con lockfile;
2. formattazione, Astro/TypeScript e lint con vincoli architetturali;
3. test unitari e di integrazione;
4. build statica;
5. test E2E Chromium e pubblicazione del report Playwright.

La revisione architetturale della seconda fase, con problemi risolti, decisioni rinviate e debito
residuo, è in [docs/review-phase-2.md](docs/review-phase-2.md).

## Deploy su Netlify

1. Verifica identità e dominio pubblico in <code>site.config.json</code>.
2. Collega il repository Git a Netlify.
3. Netlify leggerà <code>netlify.toml</code>:
   - build: <code>pnpm build</code>;
   - publish: <code>dist</code>;
   - Node 24 e pnpm 11.
4. Effettua un deploy e verifica la ricezione del form nella sezione Forms di Netlify.

Non inserire segreti nel repository. Quando verranno aggiunti pagamenti reali servirà un flusso
server-side dedicato e conforme al provider scelto.

## Limiti della prima fase

- identità, profilo, link e dominio canonico sono dimostrativi;
- nessun pagamento, donazione reale, autenticazione o CMS remoto;
- il form richiede un deploy Netlify per la ricezione effettiva;
- i download non sono ancora collegati a file consegnabili;
- la homepage include esperienze creative CSS/TypeScript per vetrina e catalogo in movimento; non
  ci sono ancora transizioni tra route, GSAP o WebGL;
- non è ancora presente una suite di visual regression.

## Prossimi passi

La prossima fase dovrebbe sostituire i contenuti demo, verificare il form su un deploy Netlify,
definire una direzione visuale definitiva e introdurre visual regression, test cross-browser e
misurazioni Lighthouse CI. Solo dopo questa stabilizzazione conviene progettare transizioni e un
creative engine progressivo.

La sequenza completa è descritta in [docs/roadmap.md](docs/roadmap.md).
