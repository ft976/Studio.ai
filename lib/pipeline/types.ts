// Shared types for the video generation pipeline.
// The design subagent should import ONLY these types plus the hooks in
// `useVideoPipeline.ts` and `useVideoHistory.ts` -- it should not call the
// generated API hooks directly.

export const THEMES = [
  { id: 'anime', label: 'Anime' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'cinematic_realistic', label: 'Cinematic Realistic' },
  { id: 'fantasy_mythical', label: 'Fantasy / Mythical' },
  { id: 'dark_horror', label: 'Dark / Horror' },
  { id: 'pixel_art_retro', label: 'Pixel Art / Retro Game' },
  { id: 'storybook_watercolor', label: 'Storybook Watercolor' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const SUBTITLE_STYLES = [
  { id: 'bold_pop', label: 'Bold Pop' },
  { id: 'neon_glow', label: 'Neon Glow' },
  { id: 'minimal_clean', label: 'Minimal Clean' },
  { id: 'comic_punch', label: 'Comic Punch' },
  { id: 'elegant_serif', label: 'Elegant Serif' },
] as const;

export type SubtitleStyleId = (typeof SUBTITLE_STYLES)[number]['id'];

export const DURATION_TIERS = [
  { id: 'short', label: '40-50s', imageCount: 7 },
  { id: 'long', label: '60-70s', imageCount: 9 },
] as const;

export type DurationTierId = (typeof DURATION_TIERS)[number]['id'];

// The 9 languages supported by the hosted voice model (magpie-tts-multilingual).
// The language picker must be built from exactly this list.
export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'it', label: 'Italian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
] as const;

export type VoiceLanguageCode = (typeof VOICE_LANGUAGES)[number]['code'];

export interface GenerationInput {
  theme: ThemeId;
  subtitleStyle: SubtitleStyleId;
  idea: string;
  language: VoiceLanguageCode;
  durationTier: DurationTierId;
  /** Number of episodes to generate (1 = single video, 2-5 = series). Default 1. */
  numParts?: number;
}

// Ordered pipeline stages surfaced to the generation screen. `detail` is a
// short human-readable status line (e.g. "Scene 3 of 7").
export type PipelineStageId =
  | 'planning_series'
  | 'writing_story'
  | 'generating_voice_and_images'
  | 'timing_sync'
  | 'assembling_video'
  | 'done'
  | 'error';

export interface PipelineProgress {
  stage: PipelineStageId;
  /** 0-100 overall progress across the whole pipeline. */
  overallPercent: number;
  detail: string;
  /** User-facing message for the 'error' stage. Undefined otherwise. */
  errorMessage?: string;
}

export interface GeneratedVideo {
  id: string;
  title: string;
  theme: ThemeId;
  subtitleStyle: SubtitleStyleId;
  language: VoiceLanguageCode;
  durationTier: DurationTierId;
  durationSec: number;
  createdAt: number;
  /** MP4 video bytes. */
  videoBlob: Blob;
  /** Small JPEG poster frame for history list thumbnails. */
  posterBlob: Blob;
  // Series fields — only present when video is part of a multi-episode series
  seriesId?: string;
  seriesTitle?: string;
  partNumber?: number;
  totalParts?: number;
}

export type OnProgress = (progress: PipelineProgress) => void;
