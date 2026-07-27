export interface ArticleGlassCubeVisual {
  readonly id: string;
  readonly accent: string;
  readonly secondaryAccent: string;
  readonly modelIndex: number;
  readonly modelUrl: string;
  readonly sourceNode: string;
  readonly motif: 'binary' | 'circuit' | 'plasma' | 'network';
}

/**
 * IDs mirror the four stable content slugs. The same mapping drives catalog
 * cards and product pages, keeping each GLB and its visual identity aligned.
 */
export const ARTICLE_GLASS_CUBE_VISUALS = [
  {
    id: 'signal-archive',
    accent: '#79ddff',
    secondaryAccent: '#9b8cff',
    modelIndex: 0,
    modelUrl: '/3D_models/glass_cubes_design_zeros_and_ones.glb',
    sourceNode: 'CUBE_04_BINARY_RAIN',
    motif: 'binary'
  },
  {
    id: 'civic-loop',
    accent: '#78e5ad',
    secondaryAccent: '#ffe27a',
    modelIndex: 1,
    modelUrl: '/3D_models/glass_cubes_design_circuit.glb',
    sourceNode: 'CUBE_03_CIRCUIT',
    motif: 'circuit'
  },
  {
    id: 'open-lab',
    accent: '#ff7797',
    secondaryAccent: '#ffb15f',
    modelIndex: 2,
    modelUrl: '/3D_models/glass_cubes_design_plasma.glb',
    sourceNode: 'CUBE_02_PLASMA',
    motif: 'plasma'
  },
  {
    id: 'product-prototype-sprint',
    accent: '#a493ff',
    secondaryAccent: '#6ee7ff',
    modelIndex: 3,
    modelUrl: '/3D_models/glass_cubes_design_S.glb',
    sourceNode: 'CUBE_01_NETWORK_S',
    motif: 'network'
  }
] as const satisfies readonly ArticleGlassCubeVisual[];

export type ArticleGlassCubeId = (typeof ARTICLE_GLASS_CUBE_VISUALS)[number]['id'];

export const DEFAULT_ARTICLE_GLASS_CUBE_ID: ArticleGlassCubeId = 'signal-archive';

export const getArticleGlassCubeVisual = (
  idOrIndex: string | number | undefined
): (typeof ARTICLE_GLASS_CUBE_VISUALS)[number] => {
  if (typeof idOrIndex === 'number') {
    const normalizedIndex =
      ((idOrIndex % ARTICLE_GLASS_CUBE_VISUALS.length) + ARTICLE_GLASS_CUBE_VISUALS.length) %
      ARTICLE_GLASS_CUBE_VISUALS.length;
    return ARTICLE_GLASS_CUBE_VISUALS[normalizedIndex] ?? ARTICLE_GLASS_CUBE_VISUALS[0];
  }
  return (
    ARTICLE_GLASS_CUBE_VISUALS.find((visual) => visual.id === idOrIndex) ??
    ARTICLE_GLASS_CUBE_VISUALS[0]
  );
};
