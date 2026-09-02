export interface ExperimentalProject {
  readonly slug: string;
  readonly index: string;
  readonly name: string;
  readonly shortName: string;
  readonly location: string;
  readonly year: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly contextImage: string;
  readonly contextImageAlt: string;
  readonly processImage: string;
  readonly processImageAlt: string;
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
    location: 'UNICAM',
    year: '2023—2026',
    image: '/media/prova/experience-physics-v1.png',
    imageAlt: 'Banco ottico e quaderno di fisica illuminati da un prisma',
    contextImage: '/media/prova/physics-topology-v2.png',
    contextImageAlt: 'Percorsi intrecciati che visualizzano topologia e braiding degli anyoni',
    processImage: '/media/prova/physics-research-process-v2.png',
    processImageAlt: 'Appunti teorici su fase geometrica, olonomie e intrecci topologici',
    status: 'available',
    accent: 'cream',
    intro:
      'Tre anni di fisica portati avanti insieme alla laurea in Informatica, conclusi con 110/110 e lode e una tesi teorica sulla computazione topologica quantistica.',
    quote:
      'Dalla fase geometrica al braiding degli anyoni: la topologia trasforma il modo in cui descriviamo l’informazione e immaginiamo un calcolo resistente agli errori.',
    features: [
      {
        title: 'Computazione topologica quantistica',
        text: 'Una tesi teorica costruita lungo il percorso fase geometrica → olonomie → topologia → anyoni → braiding → computazione quantistica.'
      },
      {
        title: 'Due lauree, un metodo',
        text: 'Fisica e informatica studiate in parallelo: formalismo matematico e pensiero algoritmico usati come prospettive complementari.'
      },
      {
        title: 'Verso la simulazione scientifica',
        text: 'La base per esplorare AI, scientific machine learning e simulazioni di sistemi complessi in fisica, biologia e medicina.'
      }
    ],
    facts: [
      { label: 'Ateneo', value: 'Università degli Studi di Camerino' },
      { label: 'Periodo', value: 'Settembre 2023 — luglio 2026' },
      { label: 'Media', value: '29,4/30' },
      { label: 'Laurea', value: '7 luglio 2026 · 110/110 e lode' },
      { label: 'Tesi', value: 'Computazione Topologica Quantistica · PHYS-04/A' }
    ]
  },
  {
    slug: 'laurea-informatica',
    index: '02',
    name: 'Laurea in Informatica',
    shortName: 'Informatica',
    location: 'UNICAM',
    year: '2024—2026',
    image: '/media/prova/experience-computer-science-v1.png',
    imageAlt: 'Postazione di programmazione con diagrammi di algoritmi e sistemi',
    contextImage: '/media/prova/computer-science-architecture-v2.png',
    contextImageAlt: 'Architettura software modulare rappresentata tra diagrammi e componenti',
    processImage: '/media/prova/computer-vision-motion-v2.png',
    processImageAlt: 'Sistema di computer vision che estrae micro-movimenti da una facciata',
    status: 'available',
    accent: 'grey',
    intro:
      'Un percorso completato in parallelo a Fisica con 110/110 e lode, dove architettura software, computer vision e analisi dei segnali sono diventati strumenti scientifici.',
    quote:
      'Quando il software misura il mondo, modularità e osservabilità non sono soltanto qualità del codice: diventano parte del metodo sperimentale.',
    features: [
      {
        title: 'Computer vision scientifica',
        text: 'Video ed elaborazione delle immagini usati per estrarre segnali di movimento e rendere leggibili micro-spostamenti quasi invisibili.'
      },
      {
        title: 'Progetto SEF',
        text: 'Il tirocinio con il Prof. Michele Loreti ha trasformato una pipeline sperimentale in un framework Python modulare ed estendibile.'
      },
      {
        title: 'Informatica come lente',
        text: 'Algoritmi, ML, signal processing e architetture software riuniti per costruire strumenti di analisi e simulazione scientifica.'
      }
    ],
    facts: [
      { label: 'Ateneo', value: 'Università degli Studi di Camerino' },
      { label: 'Periodo', value: 'Settembre 2024 — luglio 2026' },
      { label: 'Media', value: '28,6/30' },
      { label: 'Laurea', value: '22 luglio 2026 · 110/110 e lode' },
      { label: 'Tirocinio', value: 'Computer vision · Prof. Michele Loreti' }
    ]
  },
  {
    slug: 'sef-framework',
    index: '03',
    name: 'SEF — Signal Extraction Framework',
    shortName: 'SEF',
    location: 'Computer vision',
    year: '2026',
    image: '/media/prova/experience-sef-v1.png',
    imageAlt: 'Pipeline modulare di monitor e dispositivi per elaborazione video',
    contextImage: '/media/prova/sef-structural-monitoring-v2.png',
    contextImageAlt: 'Monitoraggio video dei micro-spostamenti di una struttura ad arco',
    processImage: '/media/prova/sef-modular-pipeline-v2.png',
    processImageAlt: 'Pipeline SEF dal video grezzo alla maschera e al segnale estratto',
    status: 'available',
    accent: 'blue',
    intro:
      'Un framework Python modulare che trasforma video di strutture in segnali spazio-temporali analizzabili, con SAM2 e tecniche di amplificazione dei micro-movimenti.',
    quote:
      'L’obiettivo non era scrivere un altro script OpenCV, ma costruire un linguaggio di pipeline in cui ogni algoritmo potesse essere osservato, sostituito e ricombinato.',
    features: [
      {
        title: 'Pipeline componibili',
        text: 'Acquisizione, segmentazione, trasformazioni ed estrazione del segnale diventano blocchi indipendenti, testabili e intercambiabili.'
      },
      {
        title: 'Segmentazione con SAM2',
        text: 'Segment Anything Model 2 isola nel tempo le regioni strutturali rilevanti, mantenendo l’analisi focalizzata sull’oggetto osservato.'
      },
      {
        title: 'Micro-movimenti visibili',
        text: 'Eulerian Video Magnification ed estrazione di segnali di moto aprono ad applicazioni di monitoraggio strutturale e sismico.'
      }
    ],
    facts: [
      { label: 'Nome', value: 'Signal Extraction Framework' },
      { label: 'Stack', value: 'Python · Computer vision · Signal processing' },
      { label: 'Modello', value: 'Segment Anything Model 2 (SAM2)' },
      { label: 'Tecnica', value: 'Eulerian Video Magnification' },
      { label: 'Applicazione', value: 'Monitoraggio strutturale e micro-movimenti' }
    ]
  },
  {
    slug: 'laboratorio-elettronico',
    index: '04',
    name: 'Laboratorio Elettronico',
    shortName: 'Elettronica',
    location: 'Physical computing',
    year: 'In evoluzione',
    image: '/media/prova/experience-electronics-v1.png',
    imageAlt: 'Banco maker con microcontrollori, sensori e strumenti elettronici',
    contextImage: '/media/prova/electronics-measurement-v2.png',
    contextImageAlt: 'Circuito verificato con oscilloscopio, multimetro e sonde',
    processImage: '/media/prova/electronics-prototyping-v2.png',
    processImageAlt: 'Evoluzione di un prototipo dalla breadboard alla scheda stabile',
    status: 'available',
    accent: 'coral',
    intro:
      'Un laboratorio personale in cui firmware, elettronica di potenza, sensori e fabbricazione trasformano modelli astratti in sistemi fisici misurabili.',
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
        text: 'Oscilloscopio, multimetro e debug metodico per confrontare il comportamento reale del circuito con il modello previsto.'
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
    location: 'Embedded systems',
    year: '10×10 / 100 LED',
    image: '/media/prova/experience-rgb-matrix-v1.png',
    imageAlt: 'Matrice RGB dieci per dieci autocostruita con microcontrollore',
    contextImage: '/media/prova/rgb-matrix-wiring-v2.png',
    contextImageAlt: 'Cablaggio posteriore e driver della matrice RGB dieci per dieci',
    processImage: '/media/prova/rgb-matrix-multiplexing-v2.png',
    processImageAlt: 'Test di multiplexing della matrice RGB con ESP32 e segnali temporali',
    status: 'available',
    accent: 'grey',
    intro:
      'Una matrice 10×10 costruita davvero da zero con cento LED RGB tradizionali a catodo comune, ESP32, shift register e multiplexing.',
    quote:
      'Cento punti luminosi diventano un sistema solo quando elettronica, firmware e costruzione fisica trovano lo stesso ritmo.',
    features: [
      {
        title: 'Cento pixel',
        text: 'Una griglia fisica 10×10 di LED non indirizzabili: geometria, diffusione e cablaggio diventano parte dell’architettura.'
      },
      {
        title: 'Multiplexing',
        text: 'ESP32 e 74HCT595N coordinano righe e canali RGB, riducendo le linee di controllo senza perdere fluidità nelle animazioni.'
      },
      {
        title: 'Potenza e timing',
        text: 'IRLZ44N, alimentazione a 5 V e firmware lavorano insieme per gestire correnti, duty cycle e stabilità visiva.'
      }
    ],
    facts: [
      { label: 'Formato', value: 'Matrice RGB 10×10' },
      { label: 'Pixel', value: '100 LED RGB tradizionali · catodo comune' },
      { label: 'Controllo', value: 'ESP32 · 74HCT595N · multiplexing' },
      { label: 'Potenza', value: 'IRLZ44N · alimentazione 5 V' },
      { label: 'Approccio', value: 'Nessun LED indirizzabile · costruzione DIY' }
    ]
  }
] as const;

export const availableExperimentalProjects = experimentalProjects.filter(
  (project) => project.status === 'available'
);

export const getExperimentalProject = (slug: string): ExperimentalProject | undefined =>
  availableExperimentalProjects.find((project) => project.slug === slug);
