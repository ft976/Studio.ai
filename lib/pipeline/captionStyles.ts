import type { SubtitleStyleId } from './types';

export interface CaptionStyleDef {
  fontFamily: string;
  fontWeight: string;
  uppercase: boolean;
  fontSizePx: number;
  textColor: string;
  strokeColor: string | null;
  strokeWidthPx: number;
  glowColor: string | null;
  glowBlurPx: number;
  backgroundColor: string | null;
  letterSpacingPx: number;
  /** Vertical position as a fraction of video height (0 = top, 1 = bottom). */
  yPositionFraction: number;
}

export const CAPTION_STYLES: Record<SubtitleStyleId, CaptionStyleDef> = {
  bold_pop: {
    fontFamily: '"Archivo Black", sans-serif',
    fontWeight: '900',
    uppercase: true,
    fontSizePx: 86,
    textColor: '#FFFFFF',
    strokeColor: '#0A0A0A',
    strokeWidthPx: 14,
    glowColor: null,
    glowBlurPx: 0,
    backgroundColor: null,
    letterSpacingPx: 1,
    yPositionFraction: 0.78,
  },
  neon_glow: {
    fontFamily: '"Syne", sans-serif',
    fontWeight: '800',
    uppercase: true,
    fontSizePx: 78,
    textColor: '#F5FBFF',
    strokeColor: '#0B0B12',
    strokeWidthPx: 6,
    glowColor: '#4CE9FF',
    glowBlurPx: 38,
    backgroundColor: null,
    letterSpacingPx: 2,
    yPositionFraction: 0.78,
  },
  minimal_clean: {
    fontFamily: '"DM Sans", sans-serif',
    fontWeight: '600',
    uppercase: false,
    fontSizePx: 62,
    textColor: '#111111',
    strokeColor: null,
    strokeWidthPx: 0,
    glowColor: null,
    glowBlurPx: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    letterSpacingPx: 0,
    yPositionFraction: 0.82,
  },
  comic_punch: {
    fontFamily: '"Bangers", cursive',
    fontWeight: '400',
    uppercase: true,
    fontSizePx: 96,
    textColor: '#FFE347',
    strokeColor: '#1A1A1A',
    strokeWidthPx: 16,
    glowColor: null,
    glowBlurPx: 0,
    backgroundColor: null,
    letterSpacingPx: 2,
    yPositionFraction: 0.76,
  },
  elegant_serif: {
    fontFamily: '"Playfair Display", serif',
    fontWeight: '700',
    uppercase: false,
    fontSizePx: 70,
    textColor: '#FFFFFF',
    strokeColor: null,
    strokeWidthPx: 0,
    glowColor: 'rgba(0,0,0,0.65)',
    glowBlurPx: 22,
    backgroundColor: null,
    letterSpacingPx: 0.5,
    yPositionFraction: 0.82,
  },
};

/**
 * Splits a narration segment into short caption chunks (2-5 words each) and
 * assigns each chunk a duration proportional to its character length within
 * the scene's total measured audio duration.
 */
export interface CaptionChunk {
  text: string;
  startSec: number;
  durationSec: number;
}

export function buildCaptionChunks(
  narrationSegment: string,
  sceneDurationSec: number,
): CaptionChunk[] {
  const words = narrationSegment.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ text: '', startSec: 0, durationSec: sceneDurationSec }];
  }

  const WORDS_PER_CHUNK = 3;
  const rawChunks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    rawChunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
  }

  const totalChars = rawChunks.reduce((sum, c) => sum + c.length, 0) || 1;

  let cursor = 0;
  return rawChunks.map((text) => {
    const durationSec = (text.length / totalChars) * sceneDurationSec;
    const chunk: CaptionChunk = { text, startSec: cursor, durationSec };
    cursor += durationSec;
    return chunk;
  });
}
