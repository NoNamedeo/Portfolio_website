export type GlassQualityName = 'mobile' | 'balanced' | 'high';
export type GlassPlateRole = 'main' | 'secondary' | 'ambient';

export const GLASS_DEBUG = false;
export const GLASS_DEBUG_MATERIAL_OPTIONS = {
  thickness: [0.05, 0.15, 0.3, 0.6],
  ior: [1.3, 1.5, 1.8],
  defaultThickness: 0.3,
  defaultIor: 1.5
} as const;

export interface GlassQuality {
  readonly name: GlassQualityName;
  readonly pixelRatioLimit: number;
  readonly transmissionResolutionScale: number;
  readonly plateCount: number;
  readonly ambientMotionScale: number;
  readonly antialias: boolean;
}

export interface GlassPlateDefinition {
  readonly id: string;
  readonly role: GlassPlateRole;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly mass: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly parallax: number;
  readonly maxTranslation: readonly [number, number, number];
  readonly maxRotation: readonly [number, number, number];
  readonly scrollOffset: readonly [number, number, number];
  readonly scrollRotation: readonly [number, number, number];
  readonly ambientAmplitude: readonly [number, number, number];
  readonly ambientFrequency: number;
  readonly phase: number;
}

const degrees = (value: number): number => (value * Math.PI) / 180;

const desktop: readonly GlassPlateDefinition[] = [
  {
    id: 'main',
    role: 'main',
    position: [0.16, 0.04, 2.5],
    rotation: [degrees(-4.5), degrees(-8), degrees(-5)],
    scale: 1.15,
    mass: 1.34,
    stiffness: 19,
    damping: 8.1,
    parallax: 1,
    maxTranslation: [1.04, 0.9, 0.6],
    maxRotation: [degrees(9), degrees(11), degrees(6)],
    scrollOffset: [0.88, 0.18, 0.28],
    scrollRotation: [degrees(-3), degrees(7), degrees(-7)],
    ambientAmplitude: [0.008, 0.018, degrees(0.48)],
    ambientFrequency: 0.19,
    phase: 0.4
  },
  {
    id: 'north-west',
    role: 'secondary',
    position: [-0.48, 0.43, 1.7],
    rotation: [degrees(5), degrees(10), degrees(11)],
    scale: 0.85,
    mass: 1.12,
    stiffness: 18,
    damping: 7.4,
    parallax: 0.76,
    maxTranslation: [1.2, 0.92, 0.55],
    maxRotation: [degrees(7), degrees(9), degrees(8)],
    scrollOffset: [-1.02, 0.54, -0.32],
    scrollRotation: [degrees(5), degrees(-5), degrees(8)],
    ambientAmplitude: [0.01, 0.02, degrees(0.56)],
    ambientFrequency: 0.16,
    phase: 1.7
  },
  {
    id: 'south-west',
    role: 'secondary',
    position: [-0.46, -0.4, 2],
    rotation: [degrees(-7), degrees(7), degrees(-8)],
    scale: 0.9,
    mass: 1.26,
    stiffness: 17,
    damping: 7.8,
    parallax: 0.86,
    maxTranslation: [1.16, 1.02, 0.58],
    maxRotation: [degrees(8), degrees(10), degrees(7)],
    scrollOffset: [-0.96, -0.52, 0.2],
    scrollRotation: [degrees(-5), degrees(6), degrees(-7)],
    ambientAmplitude: [0.009, 0.021, degrees(0.5)],
    ambientFrequency: 0.18,
    phase: 3.2
  },
  {
    id: 'south-east',
    role: 'secondary',
    position: [0.48, -0.4, 1.8],
    rotation: [degrees(6), degrees(-9), degrees(8)],
    scale: 0.82,
    mass: 1.08,
    stiffness: 20,
    damping: 7.3,
    parallax: 0.92,
    maxTranslation: [1.16, 0.98, 0.64],
    maxRotation: [degrees(9), degrees(11), degrees(8)],
    scrollOffset: [0.98, -0.5, 0.32],
    scrollRotation: [degrees(4), degrees(-7), degrees(8)],
    ambientAmplitude: [0.01, 0.019, degrees(0.6)],
    ambientFrequency: 0.21,
    phase: 4.4
  },
  {
    id: 'north-east',
    role: 'secondary',
    position: [0.52, 0.45, 1.3],
    rotation: [degrees(-5), degrees(-7), degrees(-12)],
    scale: 0.8,
    mass: 1.4,
    stiffness: 16,
    damping: 8.4,
    parallax: 0.62,
    maxTranslation: [1.15, 0.96, 0.5],
    maxRotation: [degrees(6), degrees(8), degrees(7)],
    scrollOffset: [0.94, 0.5, -0.45],
    scrollRotation: [degrees(-4), degrees(5), degrees(-8)],
    ambientAmplitude: [0.007, 0.016, degrees(0.42)],
    ambientFrequency: 0.14,
    phase: 5.8
  },
  {
    id: 'far-north',
    role: 'ambient',
    position: [-0.04, 0.62, 0.6],
    rotation: [degrees(8), degrees(5), degrees(3)],
    scale: 0.72,
    mass: 1.58,
    stiffness: 15,
    damping: 8.7,
    parallax: 0.38,
    maxTranslation: [0.88, 0.82, 0.42],
    maxRotation: [degrees(5), degrees(6), degrees(5)],
    scrollOffset: [-0.16, 0.92, -0.4],
    scrollRotation: [degrees(3), degrees(3), degrees(5)],
    ambientAmplitude: [0.006, 0.014, degrees(0.36)],
    ambientFrequency: 0.13,
    phase: 2.5
  },
  {
    id: 'far-south',
    role: 'ambient',
    position: [0.02, -0.62, 0.8],
    rotation: [degrees(-6), degrees(7), degrees(-3)],
    scale: 0.7,
    mass: 1.7,
    stiffness: 14,
    damping: 9,
    parallax: 0.3,
    maxTranslation: [0.82, 0.88, 0.4],
    maxRotation: [degrees(5), degrees(5), degrees(4)],
    scrollOffset: [0.14, -0.92, -0.38],
    scrollRotation: [degrees(-3), degrees(2), degrees(-5)],
    ambientAmplitude: [0.005, 0.013, degrees(0.32)],
    ambientFrequency: 0.12,
    phase: 6.4
  },
  {
    id: 'mid-west',
    role: 'secondary',
    position: [-0.22, 0.08, 2.1],
    rotation: [degrees(4), degrees(-10), degrees(6)],
    scale: 0.86,
    mass: 1.18,
    stiffness: 18,
    damping: 7.7,
    parallax: 0.82,
    maxTranslation: [1.02, 0.86, 0.54],
    maxRotation: [degrees(8), degrees(9), degrees(7)],
    scrollOffset: [-0.58, 0.16, 0.18],
    scrollRotation: [degrees(4), degrees(-5), degrees(6)],
    ambientAmplitude: [0.009, 0.018, degrees(0.48)],
    ambientFrequency: 0.17,
    phase: 0.95
  },
  {
    id: 'center-back',
    role: 'ambient',
    position: [0.24, 0.29, 1],
    rotation: [degrees(-7), degrees(9), degrees(-7)],
    scale: 0.8,
    mass: 1.52,
    stiffness: 15.5,
    damping: 8.6,
    parallax: 0.5,
    maxTranslation: [0.92, 0.84, 0.44],
    maxRotation: [degrees(6), degrees(7), degrees(6)],
    scrollOffset: [0.46, 0.64, -0.34],
    scrollRotation: [degrees(-3), degrees(4), degrees(-6)],
    ambientAmplitude: [0.006, 0.015, degrees(0.38)],
    ambientFrequency: 0.135,
    phase: 2.15
  },
  {
    id: 'west-edge',
    role: 'ambient',
    position: [-0.67, 0.02, 0.65],
    rotation: [degrees(7), degrees(12), degrees(-5)],
    scale: 0.75,
    mass: 1.46,
    stiffness: 15.8,
    damping: 8.5,
    parallax: 0.48,
    maxTranslation: [0.88, 0.82, 0.46],
    maxRotation: [degrees(6), degrees(7), degrees(5)],
    scrollOffset: [-0.78, -0.08, -0.28],
    scrollRotation: [degrees(4), degrees(-4), degrees(5)],
    ambientAmplitude: [0.006, 0.015, degrees(0.4)],
    ambientFrequency: 0.145,
    phase: 3.75
  },
  {
    id: 'east-edge',
    role: 'ambient',
    position: [0.7, 0.01, 0.55],
    rotation: [degrees(-5), degrees(-11), degrees(5)],
    scale: 0.75,
    mass: 1.62,
    stiffness: 14.8,
    damping: 8.9,
    parallax: 0.4,
    maxTranslation: [0.84, 0.8, 0.42],
    maxRotation: [degrees(5), degrees(6), degrees(5)],
    scrollOffset: [0.8, 0.05, -0.34],
    scrollRotation: [degrees(-3), degrees(4), degrees(-5)],
    ambientAmplitude: [0.005, 0.014, degrees(0.35)],
    ambientFrequency: 0.125,
    phase: 5.15
  },
  {
    id: 'lower-center',
    role: 'secondary',
    position: [-0.14, -0.27, 1.6],
    rotation: [degrees(6), degrees(-6), degrees(4)],
    scale: 0.8,
    mass: 1.3,
    stiffness: 17.2,
    damping: 8,
    parallax: 0.68,
    maxTranslation: [0.98, 0.9, 0.5],
    maxRotation: [degrees(7), degrees(8), degrees(6)],
    scrollOffset: [-0.24, -0.68, -0.18],
    scrollRotation: [degrees(4), degrees(-3), degrees(5)],
    ambientAmplitude: [0.008, 0.017, degrees(0.44)],
    ambientFrequency: 0.155,
    phase: 6.85
  }
];

const tablet: readonly GlassPlateDefinition[] = desktop.slice(0, 9).map((plate, index) => {
  const positions: ReadonlyArray<readonly [number, number, number]> = [
    [0.14, 0.03, 2.3],
    [-0.46, 0.43, 1.55],
    [-0.44, -0.42, 1.85],
    [0.46, -0.4, 1.65],
    [0.5, 0.44, 1.15],
    [-0.03, 0.63, 0.55],
    [0.03, -0.64, 0.72],
    [-0.2, 0.08, 1.95],
    [0.22, 0.28, 0.9]
  ];
  return {
    ...plate,
    position: positions[index] ?? plate.position,
    scale: plate.scale * 0.94,
    parallax: plate.parallax * 0.82,
    ambientAmplitude: [
      plate.ambientAmplitude[0] * 0.8,
      plate.ambientAmplitude[1] * 0.8,
      plate.ambientAmplitude[2] * 0.8
    ]
  };
});

const mobile: readonly GlassPlateDefinition[] = desktop.slice(0, 7).map((plate, index) => {
  const positions: ReadonlyArray<readonly [number, number, number]> = [
    [0.05, 0.01, 2.2],
    [-0.38, 0.48, 1.35],
    [-0.38, -0.46, 1.55],
    [0.4, -0.37, 1.25],
    [0.4, 0.44, 0.8],
    [-0.02, 0.62, 0.4],
    [0.18, 0.15, 1]
  ];
  const scales = [0.68, 0.52, 0.55, 0.5, 0.48, 0.44, 0.48];
  return {
    ...plate,
    position: positions[index] ?? plate.position,
    scale: scales[index] ?? plate.scale * 0.62,
    parallax: plate.parallax * 0.32,
    maxRotation: [
      plate.maxRotation[0] * 0.45,
      plate.maxRotation[1] * 0.45,
      plate.maxRotation[2] * 0.45
    ],
    ambientAmplitude: [
      plate.ambientAmplitude[0] * 0.45,
      plate.ambientAmplitude[1] * 0.45,
      plate.ambientAmplitude[2] * 0.45
    ],
    scrollOffset: [
      plate.scrollOffset[0] * 0.62,
      plate.scrollOffset[1] * 0.62,
      plate.scrollOffset[2] * 0.45
    ]
  };
});

const separateDepthLanes = (
  layout: readonly GlassPlateDefinition[],
  depths: readonly number[]
): readonly GlassPlateDefinition[] =>
  layout.map((plate, index): GlassPlateDefinition => {
    const isMainPlate = plate.id === 'main';
    const baseXDirection = Math.sign(plate.rotation[0]) || 1;
    const baseYDirection = Math.sign(plate.rotation[1]) || 1;
    const scrollXDirection = Math.sign(plate.scrollRotation[0]) || 1;
    const scrollYDirection = Math.sign(plate.scrollRotation[1]) || 1;
    return {
      ...plate,
      position: [plate.position[0], plate.position[1], depths[index] ?? plate.position[2]],
      rotation: isMainPlate
        ? [degrees(-5), degrees(-7), plate.rotation[2]]
        : [degrees(baseXDirection), degrees(baseYDirection * 1.2), plate.rotation[2]],
      maxTranslation: [plate.maxTranslation[0], plate.maxTranslation[1], 0.04],
      maxRotation: isMainPlate
        ? [degrees(1.2), degrees(1.5), plate.maxRotation[2]]
        : [degrees(2), degrees(2.2), plate.maxRotation[2]],
      scrollOffset: [plate.scrollOffset[0], plate.scrollOffset[1], 0],
      scrollRotation: [
        degrees(scrollXDirection * 0.7),
        degrees(scrollYDirection * 0.8),
        plate.scrollRotation[2]
      ]
    };
  });

const separatedDesktop = separateDepthLanes(
  desktop,
  [5.4, 2.6, 3.9, 3.25, 1.3, 0, -0.65, 4.55, 0.65, -1.3, -1.95, 1.95]
);
const separatedTablet = separateDepthLanes(tablet, [5, 2.4, 3.6, 3, 1.2, 0, -0.6, 4.2, 0.6]);
const separatedMobile = separateDepthLanes(mobile, [4.5, 2.4, 3.6, 3, 1.8, 1.2, 0.6]);

export const GLASS_LAYOUTS: Readonly<Record<GlassQualityName, readonly GlassPlateDefinition[]>> = {
  mobile: separatedMobile,
  balanced: separatedTablet,
  high: separatedDesktop
};

export const GLASS_CONFIG = {
  modelUrl: '/3D_models/glass_plate_web.glb',
  targetMeshName: 'GlassPlate_Main',
  slogans: {
    back: {
      modelUrl: '/3D_models/competenze_in_vetrina.glb',
      targetMeshName: 'TXT_COMPETENZE_IN_VETRINA'
    },
    front: {
      modelUrl: '/3D_models/idee_in_movimento.glb',
      targetMeshName: 'TXT_IDEE_IN_MOVIMENTO'
    }
  },
  camera: {
    fov: 36,
    near: 0.1,
    far: 60,
    positionZ: 12.5
  },
  material: {
    color: 0xffffff,
    metalness: 0,
    roughness: 0.045,
    transmission: 1,
    opacity: 1,
    ior: 1.5,
    thickness: 0.3,
    clearcoat: 0.82,
    clearcoatRoughness: 0.025,
    envMapIntensity: 1.1,
    specularIntensity: 0.92,
    dispersion: 0.012,
    attenuationColor: 0xf2f8ff,
    attenuationDistance: 12,
    normalScale: 0.055
  },
  lighting: {
    hemisphereIntensity: 0.4,
    keyIntensity: 0.78,
    rimIntensity: 0.52
  },
  motion: {
    pointerDamping: 7.5,
    scrollDamping: 8.5,
    pointerTranslation: 0.044,
    pointerDepth: 0.2,
    ambientRotationScale: 1,
    maximumDeltaSeconds: 0.05
  }
} as const;

const readDeviceMemory = (): number => {
  const navigatorWithMemory = navigator as Navigator & { readonly deviceMemory?: number };
  return navigatorWithMemory.deviceMemory ?? 8;
};

export const selectGlassQuality = (viewportWidth: number, reducedMotion: boolean): GlassQuality => {
  const memory = readDeviceMemory();
  if (viewportWidth <= 736 || memory <= 4) {
    return {
      name: 'mobile',
      pixelRatioLimit: 1.15,
      transmissionResolutionScale: reducedMotion ? 0.48 : 0.62,
      plateCount: 7,
      ambientMotionScale: 0.42,
      antialias: false
    };
  }
  if (viewportWidth <= 1180 || memory <= 6) {
    return {
      name: 'balanced',
      pixelRatioLimit: 1.42,
      transmissionResolutionScale: reducedMotion ? 0.62 : 0.82,
      plateCount: 9,
      ambientMotionScale: 0.75,
      antialias: true
    };
  }
  return {
    name: 'high',
    pixelRatioLimit: 1.65,
    transmissionResolutionScale: reducedMotion ? 0.72 : 1,
    plateCount: 12,
    ambientMotionScale: 1,
    antialias: true
  };
};
