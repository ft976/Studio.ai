import type { SubtitleStyleId } from './types';
import { CAPTION_STYLES, buildCaptionChunks } from './captionStyles';

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

export interface RenderedFrame {
  blob: Blob;
  durationSec: number;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  styleId: SubtitleStyleId,
  scale: number,
  opacity: number,
): void {
  if (!text) return;
  const style = CAPTION_STYLES[styleId];
  const displayText = style.uppercase ? text.toUpperCase() : text;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `${style.fontWeight} ${style.fontSizePx}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = VIDEO_WIDTH * 0.86;
  const lines = wrapText(ctx, displayText, maxWidth);
  const lineHeight = style.fontSizePx * 1.18;
  const totalHeight = lineHeight * lines.length;
  const centerY = VIDEO_HEIGHT * style.yPositionFraction;
  const centerX = VIDEO_WIDTH / 2;

  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  lines.forEach((line, i) => {
    const y = centerY - totalHeight / 2 + lineHeight * i + lineHeight / 2;

    if (style.backgroundColor) {
      const metrics = ctx.measureText(line);
      const paddingX = 28;
      const paddingY = 14;
      ctx.fillStyle = style.backgroundColor;
      const bw = metrics.width + paddingX * 2;
      const bh = style.fontSizePx + paddingY * 2;
      const bx = centerX - bw / 2;
      const by = y - bh / 2;
      const radius = 16;
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, radius);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, radius);
      ctx.arcTo(bx, by + bh, bx, by, radius);
      ctx.arcTo(bx, by, bx + bw, by, radius);
      ctx.closePath();
      ctx.fill();
    }

    if (style.glowColor) {
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glowBlurPx;
    } else {
      ctx.shadowBlur = 0;
    }

    if (style.letterSpacingPx > 0 && 'letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${style.letterSpacingPx}px`;
    }

    if (style.strokeColor && style.strokeWidthPx > 0) {
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidthPx;
      ctx.strokeText(line, centerX, y);
    }

    ctx.fillStyle = style.textColor;
    ctx.fillText(line, centerX, y);
  });

  ctx.restore();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
): void {
  const imgRatio = img.width / img.height;
  const targetRatio = VIDEO_WIDTH / VIDEO_HEIGHT;
  let drawWidth: number;
  let drawHeight: number;
  if (imgRatio > targetRatio) {
    drawHeight = VIDEO_HEIGHT;
    drawWidth = drawHeight * imgRatio;
  } else {
    drawWidth = VIDEO_WIDTH;
    drawHeight = drawWidth / imgRatio;
  }
  const dx = (VIDEO_WIDTH - drawWidth) / 2;
  const dy = (VIDEO_HEIGHT - drawHeight) / 2;
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      0.88,
    );
  });
}

/**
 * Renders one scene (a static background image + its animated pop-in
 * captions) as a small sequence of JPEG frames with per-frame durations,
 * suitable for ffmpeg's concat demuxer.
 */
export async function renderSceneFrames(params: {
  image: ImageBitmap;
  narrationSegment: string;
  sceneDurationSec: number;
  subtitleStyle: SubtitleStyleId;
}): Promise<RenderedFrame[]> {
  const { image, narrationSegment, sceneDurationSec, subtitleStyle } = params;
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D canvas context');

  const chunks = buildCaptionChunks(narrationSegment, sceneDurationSec);
  const frames: RenderedFrame[] = [];
  const POP_DURATION_SEC = 0.12;

  for (const chunk of chunks) {
    const holdDuration = Math.max(chunk.durationSec - POP_DURATION_SEC, 0.05);

    // Pop-in frame: slightly scaled down and faded in.
    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    drawCoverImage(ctx, image);
    drawCaption(ctx, chunk.text, subtitleStyle, 0.82, 0.55);
    frames.push({ blob: await canvasToBlob(canvas), durationSec: POP_DURATION_SEC });

    // Hold frame: full scale and opacity for the remainder of the chunk.
    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    drawCoverImage(ctx, image);
    drawCaption(ctx, chunk.text, subtitleStyle, 1, 1);
    frames.push({ blob: await canvasToBlob(canvas), durationSec: holdDuration });
  }

  return frames;
}

/** Renders a plain poster frame (first scene image, no caption) for history thumbnails. */
export async function renderPosterFrame(image: ImageBitmap): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D canvas context');
  drawCoverImage(ctx, image);
  return canvasToBlob(canvas);
}
