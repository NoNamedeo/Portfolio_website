# Roadmap

La roadmap mantiene accessibilità, contenuto e prestazioni come vincoli. Ogni fase deve produrre un
sito utilizzabile prima di introdurre il livello successivo.

## 1. Base e contenuti

Stato: completata come fondazione.

- architettura, dominio e casi d’uso;
- catalogo MDX e profilo;
- route statiche;
- carrello locale e checkout di richiesta;
- design system iniziale;
- test, SEO e Netlify.
- quality gate CI, migrazione storage e vincoli architetturali automatici.

Prima del rilascio pubblico: sostituire tutti i dati dimostrativi, il dominio canonico, i link e i
media.

## 2. Raffinamento visuale

- definire art direction, griglia e ritmo tipografico definitivi;
- progettare immagini e poster per ogni articolo;
- validare contrasto, zoom 200% e layout alle dimensioni estreme;
- eseguire test di usabilità su catalogo e metafora del checkout;
- aggiungere visual regression per breakpoint principali.

## 3. Transizioni

- progettare transizioni progressive fra catalogo e scheda;
- usare gli hook semantici esistenti;
- mantenere link reali e history corretta;
- garantire un percorso equivalente con movimento ridotto;
- evitare di bloccare la navigazione durante il caricamento.

## 4. GSAP

- introdurre GSAP soltanto dopo aver definito casi d’uso visivi concreti;
- caricare il codice in modo dinamico per esperienza;
- isolare gli adapter nell’experience layer;
- distruggere timeline e listener a ogni cambio pagina.

## 5. Three.js e shader

- prototipare una sola scena ad alto valore;
- usare fallback statici;
- sospendere rendering fuori viewport e su tab nascosto;
- adattare pixel ratio, memoria e qualità al dispositivo.

## 6. Creative engine

- estendere ExperienceRegistry alle future esperienze dichiarate da ArtDirection;
- definire lifecycle, preload e cleanup;
- aggiungere telemetria prestazionale locale;
- documentare il contratto fra markup, modelli e scene.

## 7. Audio opzionale

- audio sempre opt-in;
- controllo persistente e accessibile;
- nessun autoplay;
- alternativa visiva completa.

## 8. CMS eventuale

- valutare il CMS soltanto quando il flusso editoriale lo richiede;
- mantenere lo schema del dominio e un adapter dedicato;
- prevedere preview, migrazione e fallback;
- non spostare regole di business nei template del CMS.

## 9. Pagamenti o donazioni reali

- definire prodotti realmente acquistabili e requisiti legali/fiscali;
- scegliere un provider e un flusso server-side sicuro;
- implementare webhook idempotenti;
- non gestire direttamente dati carta;
- introdurre porte e adapter server-side solo dopo avere definito il flusso reale.

## 10. Analytics

- raccogliere il minimo indispensabile;
- rispettare consenso e normativa applicabile;
- misurare ricerca, filtri, schede e completamento della richiesta;
- evitare script che degradino Core Web Vitals.

## 11. Visual regression

- snapshot desktop e mobile delle route principali;
- stati vuoti, filtri, carrello e form;
- confronto su browser Chromium, Firefox e WebKit;
- soglie esplicite e review umana.

## 12. Performance auditing

Budget iniziali da verificare su build di produzione e rete mobile simulata:

| Metrica                        | Budget                                |
| ------------------------------ | ------------------------------------- |
| JavaScript iniziale per pagina | massimo 50 kB gzip                    |
| CSS globale                    | massimo 45 kB gzip                    |
| LCP p75 mobile                 | meno di 2,5 s                         |
| CLS p75                        | meno di 0,1                           |
| INP p75                        | meno di 200 ms                        |
| Immagine hero                  | massimo 250 kB, dimensioni dichiarate |
| Richieste iniziali homepage    | massimo 20                            |
| Lighthouse accessibilità       | almeno 95                             |
| Lighthouse performance mobile  | almeno 90                             |

Azioni:

- report automatico delle dimensioni bundle;
- Lighthouse CI su pull request;
- verifica immagini AVIF/WebP;
- audit di font, cache e third-party;
- profiling delle future scene creative.

## 13. Candidatura Awwwards

- curare narrazione, microcopy e ritmo;
- completare test cross-browser e dispositivi reali;
- eseguire audit WCAG 2.2 AA con strumenti e revisione manuale;
- controllare fallback, errori e condizioni di rete lenta;
- preparare case study, video e materiali di candidatura;
- candidare soltanto una build stabile, misurata e mantenibile.
