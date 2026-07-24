import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three';

interface TextLine {
  text: string;
  left: number;
  top: number;
}

type LetterSpacedContext = CanvasRenderingContext2D & {
  letterSpacing?: string;
};

const findTextNode = (element: HTMLElement): Text | undefined =>
  [...element.childNodes].find((node): node is Text => node.nodeType === Node.TEXT_NODE);

const readRenderedLines = (element: HTMLElement, origin: DOMRect): TextLine[] => {
  const textNode = findTextNode(element);
  if (!textNode?.data) return [];

  const lines: Array<TextLine & { sourceTop: number }> = [];
  const range = document.createRange();
  for (let index = 0; index < textNode.data.length; index += 1) {
    range.setStart(textNode, index);
    range.setEnd(textNode, index + 1);
    const rect = range.getBoundingClientRect();
    const character = textNode.data[index] ?? '';
    const previousLine = lines.at(-1);
    const line =
      previousLine && Math.abs(previousLine.sourceTop - rect.top) < 2 ? previousLine : undefined;

    if (line) {
      line.text += character;
      line.left = Math.min(line.left, rect.left - origin.left);
    } else {
      lines.push({
        text: character,
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        sourceTop: rect.top
      });
    }
  }
  return lines.map(({ text, left, top }) => ({
    text: text.trimEnd().toLocaleUpperCase('it'),
    left,
    top
  }));
};

const fillStageBackdrop = (
  context: CanvasRenderingContext2D,
  stageRect: DOMRect,
  glassRect: DOMRect
): void => {
  const stageLeft = stageRect.left - glassRect.left;
  const stageTop = stageRect.top - glassRect.top;
  const stageRight = stageLeft + stageRect.width;
  const stageBottom = stageTop + stageRect.height;

  const baseGradient = context.createLinearGradient(stageLeft, stageTop, stageRight, stageBottom);
  baseGradient.addColorStop(0, '#11120f');
  baseGradient.addColorStop(0.48, '#20221f');
  baseGradient.addColorStop(1, '#10110f');
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, glassRect.width, glassRect.height);

  const orangeCenterX = stageLeft + stageRect.width * 0.2;
  const orangeCenterY = stageTop + stageRect.height * 0.18;
  const orange = context.createRadialGradient(
    orangeCenterX,
    orangeCenterY,
    0,
    orangeCenterX,
    orangeCenterY,
    Math.max(stageRect.width, stageRect.height) * 0.37
  );
  orange.addColorStop(0, 'rgb(255 90 61 / 0.19)');
  orange.addColorStop(1, 'rgb(255 90 61 / 0)');
  context.fillStyle = orange;
  context.fillRect(0, 0, glassRect.width, glassRect.height);

  const blueCenterX = stageLeft + stageRect.width * 0.82;
  const blueCenterY = stageTop + stageRect.height * 0.76;
  const blue = context.createRadialGradient(
    blueCenterX,
    blueCenterY,
    0,
    blueCenterX,
    blueCenterY,
    Math.max(stageRect.width, stageRect.height) * 0.4
  );
  blue.addColorStop(0, 'rgb(80 112 255 / 0.15)');
  blue.addColorStop(1, 'rgb(80 112 255 / 0)');
  context.fillStyle = blue;
  context.fillRect(0, 0, glassRect.width, glassRect.height);

  const ambient = context.createLinearGradient(
    glassRect.width * 0.08,
    0,
    glassRect.width * 0.92,
    glassRect.height
  );
  ambient.addColorStop(0, 'rgb(255 255 255 / 0.025)');
  ambient.addColorStop(0.46, 'rgb(255 255 255 / 0)');
  ambient.addColorStop(0.72, 'rgb(130 154 255 / 0.035)');
  ambient.addColorStop(1, 'rgb(255 255 255 / 0)');
  context.fillStyle = ambient;
  context.fillRect(0, 0, glassRect.width, glassRect.height);
};

const drawBackText = (
  context: LetterSpacedContext,
  backText: HTMLElement,
  glassRect: DOMRect
): void => {
  const style = getComputedStyle(backText);
  const lines = readRenderedLines(backText, glassRect);
  const fontSize = Number.parseFloat(style.fontSize) || 96;
  context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  context.fontKerning = 'normal';
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.letterSpacing = style.letterSpacing;
  context.fillStyle = style.color;
  context.shadowColor = 'rgb(0 0 0 / 0.24)';
  context.shadowBlur = fontSize * 0.18;
  context.shadowOffsetY = fontSize * 0.04;

  for (const line of lines) {
    context.fillText(line.text, line.left, line.top + fontSize * 0.79);
  }
};

export class GlassSceneTextures {
  readonly backdropTexture: Texture;
  readonly textTexture: Texture;

  private readonly backdropCanvas = document.createElement('canvas');
  private readonly textCanvas = document.createElement('canvas');
  private readonly backdropContext: CanvasRenderingContext2D;
  private readonly textContext: CanvasRenderingContext2D;

  constructor() {
    const backdropContext = this.backdropCanvas.getContext('2d', { alpha: false });
    const textContext = this.textCanvas.getContext('2d');
    if (!backdropContext || !textContext) {
      throw new Error('Impossibile creare le texture 2D della lastra.');
    }
    this.backdropContext = backdropContext;
    this.textContext = textContext;
    this.backdropTexture = new CanvasTexture(this.backdropCanvas);
    this.textTexture = new CanvasTexture(this.textCanvas);
    for (const texture of [this.backdropTexture, this.textTexture]) {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
    }
  }

  update(
    stage: HTMLElement,
    glass: HTMLElement,
    backText: HTMLElement,
    pixelWidth: number,
    pixelHeight: number
  ): void {
    const glassRect = glass.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(pixelWidth));
    const height = Math.max(1, Math.round(pixelHeight));
    this.backdropCanvas.width = width;
    this.backdropCanvas.height = height;
    this.textCanvas.width = width;
    this.textCanvas.height = height;

    const scaleX = width / Math.max(glassRect.width, 1);
    const scaleY = height / Math.max(glassRect.height, 1);
    this.backdropContext.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    this.textContext.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    this.backdropContext.clearRect(0, 0, glassRect.width, glassRect.height);
    this.textContext.clearRect(0, 0, glassRect.width, glassRect.height);

    fillStageBackdrop(this.backdropContext, stageRect, glassRect);
    drawBackText(this.textContext, backText, glassRect);
    this.backdropTexture.needsUpdate = true;
    this.textTexture.needsUpdate = true;
  }

  dispose(): void {
    this.backdropTexture.dispose();
    this.textTexture.dispose();
    this.backdropCanvas.width = 1;
    this.backdropCanvas.height = 1;
    this.textCanvas.width = 1;
    this.textCanvas.height = 1;
  }
}
