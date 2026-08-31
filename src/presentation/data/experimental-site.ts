export interface ExperimentalProject {
  readonly slug: string;
  readonly index: string;
  readonly name: string;
  readonly shortName: string;
  readonly location: string;
  readonly year: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly status: 'available' | 'coming-soon';
  readonly accent: 'cream' | 'blue' | 'coral' | 'grey';
  readonly intro: string;
  readonly quote: string;
  readonly features: readonly {
    readonly title: string;
    readonly text: string;
  }[];
  readonly facts: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}

export const experimentalProjects: readonly ExperimentalProject[] = [
  {
    slug: 'laurea-fisica',
    index: '01',
    name: 'Laurea in Fisica',
    shortName: 'Fisica',
    location: 'Metodo e ricerca',
    year: 'Laurea',
    image: '/media/prova/experience-physics-v1.png',
    imageAlt: 'Banco ottico e quaderno di fisica illuminati da un prisma',
    status: 'available',
    accent: 'cream',
    intro:
      'Un percorso costruito tra modelli, misura e verifica: la base scientifica con cui affronto problemi complessi senza perdere curiosità.',
    quote:
      'Capire un fenomeno significa imparare a separare il rumore dal segnale, senza smettere di cercare ciò che ancora non torna.',
    features: [
      {
        title: 'Metodo quantitativo',
        text: 'Dalle ipotesi ai risultati: formalizzare un problema, misurarlo e controllare ogni passaggio.'
      },
      {
        title: 'Modelli',
        text: 'Tradurre sistemi reali in rappresentazioni utili, sapendo dove una semplificazione smette di funzionare.'
      },
      {
        title: 'Ricerca',
        text: 'Tenere insieme rigore e curiosità, facendo delle domande giuste il primo vero strumento di lavoro.'
      }
    ],
    facts: [
      { label: 'Ambito', value: 'Fisica' },
      { label: 'Approccio', value: 'Sperimentale e quantitativo' },
      { label: 'Competenze', value: 'Modellazione · Analisi · Misura' },
      { label: 'Stato', value: 'Percorso completato' }
    ]
  },
  {
    slug: 'laurea-informatica',
    index: '02',
    name: 'Laurea in Informatica',
    shortName: 'Informatica',
    location: 'Software e sistemi',
    year: 'Laurea',
    image: '/media/prova/experience-computer-science-v1.png',
    imageAlt: 'Postazione di programmazione con diagrammi di algoritmi e sistemi',
    status: 'available',
    accent: 'grey',
    intro:
      'La seconda prospettiva del mio percorso: progettare software chiaro, ragionare per astrazioni e trasformare idee in sistemi affidabili.',
    quote:
      'Il codice migliore non si limita a funzionare: rende leggibile il pensiero che lo ha costruito.',
    features: [
      {
        title: 'Algoritmi',
        text: 'Scomporre problemi, riconoscere strutture ricorrenti e scegliere soluzioni proporzionate.'
      },
      {
        title: 'Architettura',
        text: 'Disegnare componenti con responsabilità chiare, confini solidi e dipendenze controllabili.'
      },
      {
        title: 'Qualità',
        text: 'Test, leggibilità e manutenzione come parti del progetto, non come rifiniture finali.'
      }
    ],
    facts: [
      { label: 'Ambito', value: 'Informatica' },
      { label: 'Approccio', value: 'Progettazione e sviluppo' },
      { label: 'Competenze', value: 'Algoritmi · Sistemi · Software' },
      { label: 'Stato', value: 'Percorso completato' }
    ]
  },
  {
    slug: 'sef-framework',
    index: '03',
    name: 'SEF Framework',
    shortName: 'SEF',
    location: 'Video processing',
    year: 'Python',
    image: '/media/prova/experience-sef-v1.png',
    imageAlt: 'Pipeline modulare di monitor e dispositivi per elaborazione video',
    status: 'available',
    accent: 'blue',
    intro:
      'Un framework Python per comporre pipeline di elaborazione video, separando acquisizione, trasformazioni e output in moduli riutilizzabili.',
    quote:
      'Una pipeline diventa davvero utile quando ogni passaggio può essere osservato, sostituito e ricombinato senza spezzare il resto.',
    features: [
      {
        title: 'Pipeline modulari',
        text: 'Blocchi indipendenti per costruire flussi di elaborazione leggibili e facilmente estendibili.'
      },
      {
        title: 'Video in Python',
        text: 'Acquisizione, trasformazioni e output coordinati in un unico modello operativo.'
      },
      {
        title: 'Estendibilità',
        text: 'Una struttura pensata per aggiungere nuovi processori senza modificare il cuore del framework.'
      }
    ],
    facts: [
      { label: 'Tipologia', value: 'Framework software' },
      { label: 'Linguaggio', value: 'Python' },
      { label: 'Dominio', value: 'Elaborazione video' },
      { label: 'Focus', value: 'Modularità · Riutilizzo · Pipeline' }
    ]
  },
  {
    slug: 'laboratorio-elettronico',
    index: '04',
    name: 'Laboratorio Elettronico',
    shortName: 'Elettronica',
    location: 'Prototipi DIY',
    year: 'Hobby',
    image: '/media/prova/experience-electronics-v1.png',
    imageAlt: 'Banco maker con microcontrollori, sensori e strumenti elettronici',
    status: 'available',
    accent: 'coral',
    intro:
      'Elettronica, sensori e microcontrollori sono il mio laboratorio personale: un luogo dove il software incontra oggetti reali.',
    quote:
      'Saldare, misurare e correggere rende ogni idea concreta — e ogni errore finalmente osservabile.',
    features: [
      {
        title: 'Prototipazione',
        text: 'Dalla breadboard a un circuito stabile, verificando un sottosistema alla volta.'
      },
      {
        title: 'Microcontrollori',
        text: 'Firmware, sensori, attuatori e comunicazione tra componenti con risorse limitate.'
      },
      {
        title: 'Misura',
        text: 'Oscilloscopio, multimetro e debug metodico per capire il comportamento reale del circuito.'
      }
    ],
    facts: [
      { label: 'Ambito', value: 'Elettronica embedded' },
      { label: 'Formato', value: 'Hobby e progetti DIY' },
      { label: 'Strumenti', value: 'MCU · Sensori · Saldatura' },
      { label: 'Stato', value: 'Laboratorio in evoluzione' }
    ]
  },
  {
    slug: 'matrice-rgb-10x10',
    index: '05',
    name: 'Matrice RGB 10×10',
    shortName: 'RGB 10×10',
    location: 'Microcontrollori',
    year: 'DIY',
    image: '/media/prova/experience-rgb-matrix-v1.png',
    imageAlt: 'Matrice RGB dieci per dieci autocostruita con microcontrollore',
    status: 'available',
    accent: 'grey',
    intro:
      'Una matrice luminosa 10×10 costruita da zero: struttura, diffusione, cablaggio e animazioni controllate via microcontrollore.',
    quote:
      'Cento punti luminosi diventano un sistema solo quando elettronica, firmware e costruzione fisica trovano lo stesso ritmo.',
    features: [
      {
        title: 'Cento pixel',
        text: 'Una griglia fisica 10×10 progettata per mantenere luce uniforme e geometria precisa.'
      },
      {
        title: 'Controllo',
        text: 'Animazioni, palette e timing coordinati dal firmware del microcontrollore.'
      },
      {
        title: 'Costruzione DIY',
        text: 'Cablaggio, alimentazione, diffusori e contenitore sviluppati come parti dello stesso oggetto.'
      }
    ],
    facts: [
      { label: 'Formato', value: 'Matrice RGB 10×10' },
      { label: 'Pixel', value: '100 LED indirizzabili' },
      { label: 'Controllo', value: 'Microcontrollore' },
      { label: 'Realizzazione', value: 'DIY' }
    ]
  }
] as const;

export const availableExperimentalProjects = experimentalProjects.filter(
  (project) => project.status === 'available'
);

export const getExperimentalProject = (slug: string): ExperimentalProject | undefined =>
  availableExperimentalProjects.find((project) => project.slug === slug);
