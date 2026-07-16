'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Film, History, Play, Plus, Loader2, Video, Trash2, Download,
  AlertCircle, RefreshCw, Wand2, Sparkles, X, Pause, Layers,
} from 'lucide-react';
import { useVideoPipeline } from '../lib/pipeline/useVideoPipeline';
import { useVideoHistory } from '../lib/pipeline/useVideoHistory';
import {
  THEMES,
  SUBTITLE_STYLES,
  DURATION_TIERS,
  VOICE_LANGUAGES,
  type GenerationInput,
  type GeneratedVideo,
  type ThemeId,
  type SubtitleStyleId,
  type DurationTierId,
  type VoiceLanguageCode,
} from '../lib/pipeline/types';

const queryClient = new QueryClient();

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── In-app video player overlay ──────────────────────────────────────────────

function VideoPlayerOverlay({ video, onClose }: { video: GeneratedVideo; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [blobUrl, setBlobUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');

  useEffect(() => {
    const bUrl = URL.createObjectURL(video.videoBlob);
    const pUrl = URL.createObjectURL(video.posterBlob);
    const t = setTimeout(() => {
      setBlobUrl(bUrl);
      setPosterUrl(pUrl);
    }, 0);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(bUrl);
      URL.revokeObjectURL(pUrl);
    };
  }, [video.videoBlob, video.posterBlob]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !blobUrl) return;
    el.play().then(() => setIsPlaying(true)).catch(() => {});
  }, [blobUrl]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); } else { el.play(); }
  };

  const handleDownload = () => {
    const ext = video.videoBlob.type.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${video.title}.${ext}`;
    a.click();
  };

  if (!blobUrl || !posterUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors z-10 cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Player */}
      <div
        className="relative w-full max-w-[360px] mx-4"
        style={{ aspectRatio: '9/16' }}
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={blobUrl}
          poster={posterUrl}
          className="w-full h-full object-cover rounded-2xl animate-in zoom-in-95 duration-300"
          loop
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        />

        {/* Tap to play/pause */}
        <div
          className={`absolute inset-0 flex items-center justify-center cursor-pointer rounded-2xl transition-opacity duration-200 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
          onClick={togglePlay}
        >
          <div className="w-16 h-16 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl">
            {isPlaying
              ? <Pause className="w-7 h-7" />
              : <Play className="w-8 h-8 fill-current ml-1" />}
          </div>
        </div>

        {/* Progress bar + controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl">
          <input
            type="range"
            min={0}
            max={video.durationSec || 1}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const t = parseFloat(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = t;
              setCurrentTime(t);
            }}
            className="w-full h-1 rounded-full accent-white mb-3 cursor-pointer"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-white/70 transition-colors cursor-pointer">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <span className="text-white/70 text-xs font-mono">
                {formatDuration(currentTime)} / {formatDuration(video.durationSec)}
              </span>
            </div>
            <button onClick={handleDownload} className="text-white hover:text-white/70 transition-colors cursor-pointer">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-white/60 text-sm font-medium px-4">{video.title}</p>
        {video.seriesTitle && video.totalParts && video.totalParts > 1 && (
          <p className="text-white/40 text-xs mt-1">
            Part {video.partNumber} of {video.totalParts}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Selectors ────────────────────────────────────────────────────────────────

function ThemeSelector({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  const THEME_GRADIENTS: Record<ThemeId, string> = {
    anime: 'from-pink-400 to-fuchsia-600',
    cartoon: 'from-yellow-400 to-orange-500',
    cinematic_realistic: 'from-slate-700 to-slate-950',
    fantasy_mythical: 'from-violet-500 to-purple-900',
    dark_horror: 'from-red-900 to-stone-950',
    pixel_art_retro: 'from-emerald-400 to-cyan-600',
    storybook_watercolor: 'from-rose-200 to-orange-200',
    '3d_render_unreal': 'from-blue-600 to-blue-900',
    vintage_photography: 'from-amber-700 to-yellow-900',
    cyberpunk_neon: 'from-cyan-400 to-purple-600',
    oil_painting: 'from-yellow-700 to-amber-900',
    comic_book: 'from-red-500 to-yellow-500',
  };
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-black/[0.04]">
      <div className="flex items-center justify-between mb-5">
        <label className="text-xl font-display font-semibold">Visual Theme</label>
        <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {THEMES.find((t) => t.id === value)?.label}
        </span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onChange(theme.id)}
            className={`relative aspect-square rounded-2xl bg-gradient-to-br ${THEME_GRADIENTS[theme.id]} transition-all duration-200 hover:scale-110 cursor-pointer ${
              value === theme.id ? 'ring-4 ring-primary ring-offset-2 scale-110' : ''
            }`}
            title={theme.label}
          />
        ))}
      </div>
    </div>
  );
}

function SubtitleStyleSelector({
  value,
  onChange,
}: {
  value: SubtitleStyleId;
  onChange: (v: SubtitleStyleId) => void;
}) {
  const STYLE_PREVIEW: Record<SubtitleStyleId, { font: string; color: string; bg: string }> = {
    bold_pop: { font: 'font-black', color: 'text-white', bg: 'bg-slate-900' },
    neon_glow: { font: 'font-bold', color: 'text-cyan-400', bg: 'bg-slate-950' },
    minimal_clean: { font: 'font-medium', color: 'text-white', bg: 'bg-stone-800' },
    comic_punch: { font: 'font-black', color: 'text-yellow-400', bg: 'bg-slate-900' },
    elegant_serif: { font: 'font-bold italic', color: 'text-amber-200', bg: 'bg-stone-900' },
  };
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-black/[0.04]">
      <label className="block text-xl font-display font-semibold mb-5">Caption Style</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SUBTITLE_STYLES.map((style) => {
          const p = STYLE_PREVIEW[style.id];
          return (
            <button
              key={style.id}
              onClick={() => onChange(style.id)}
              className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition-all duration-200 hover:scale-105 cursor-pointer ${
                value === style.id ? 'border-primary bg-primary/5 scale-105' : 'border-transparent bg-muted/40'
              }`}
            >
              <div className={`${p.bg} rounded-lg px-2 py-1.5 text-center w-full`}>
                <span className={`text-[11px] ${p.font} ${p.color}`}>Aa</span>
              </div>
              <span className="text-xs font-semibold text-center text-foreground leading-tight">
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsSelectors({
  duration,
  onDurationChange,
  language,
  onLanguageChange,
}: {
  duration: DurationTierId;
  onDurationChange: (v: DurationTierId) => void;
  language: VoiceLanguageCode;
  onLanguageChange: (v: VoiceLanguageCode) => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-black/[0.04]">
      <label className="block text-xl font-display font-semibold mb-5">Settings</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Duration per part
          </p>
          <div className="flex gap-3">
            {DURATION_TIERS.map((tier) => (
              <button
                key={tier.id}
                onClick={() => onDurationChange(tier.id)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                  duration === tier.id
                    ? 'bg-foreground text-background shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Language
          </p>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as VoiceLanguageCode)}
            className="w-full py-3 px-4 rounded-xl bg-muted border-2 border-transparent focus:border-primary/30 outline-none font-medium text-sm cursor-pointer"
          >
            {VOICE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── AI Idea helper hook ───────────────────────────────────────────────────────

function useAiIdea(onIdea: (idea: string) => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-idea', { method: 'POST' });
      const data = (await res.json()) as { idea?: string; error?: string };
      if (!res.ok || !data.idea) throw new Error(data.error ?? 'Failed to generate idea');
      onIdea(data.idea);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error };
}

// ─── CreateScreen ─────────────────────────────────────────────────────────────

function CreateScreen({ onGenerate }: { onGenerate: (input: GenerationInput) => void }) {
  const [theme, setTheme] = useState<ThemeId>('cinematic_realistic');
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleId>('bold_pop');
  const [durationTier, setDurationTier] = useState<DurationTierId>('short');
  const [language, setLanguage] = useState<VoiceLanguageCode>('en');
  const [idea, setIdea] = useState('');
  const [numParts, setNumParts] = useState(1);

  const aiIdea = useAiIdea((generated) => setIdea(generated));

  const handleGenerate = () => {
    if (!idea.trim()) return;
    onGenerate({ theme, subtitleStyle, durationTier, language, idea, numParts });
  };

  const PART_OPTIONS = [
    { value: 1, label: '1', sub: 'Single' },
    { value: 2, label: '2', sub: 'Parts' },
    { value: 3, label: '3', sub: 'Parts' },
    { value: 4, label: '4', sub: 'Parts' },
    { value: 5, label: '5', sub: 'Parts' },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-2">
          <Wand2 className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Pocket <span className="text-primary">Studio</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Turn a one-line idea into a finished vertical short video with narration, cinematic pacing,
          and animated captions.
        </p>
      </div>

      <div className="space-y-6">
        {/* Idea input */}
        <section>
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-black/[0.04]">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xl font-display font-semibold">What&apos;s the idea?</label>
              <button
                onClick={aiIdea.generate}
                disabled={aiIdea.isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 cursor-pointer"
                title="Let AI write an idea for you"
              >
                {aiIdea.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {aiIdea.isLoading ? 'Thinking…' : 'Inspire me'}
              </button>
            </div>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A lone astronaut discovers a glowing doorway on the dark side of the moon..."
              className="w-full min-h-[120px] p-5 bg-muted/30 border-2 border-transparent focus:border-primary/30 focus:bg-white rounded-2xl text-lg resize-none outline-none transition-all placeholder:text-muted-foreground/60"
            />
            {aiIdea.error && (
              <p className="mt-2 text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {aiIdea.error}
              </p>
            )}
          </div>
        </section>

        {/* Number of parts */}
        <section>
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-black/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xl font-display font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Number of Parts
              </label>
              <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
                {numParts === 1 ? 'Single video' : `${numParts}-part series`}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {numParts === 1
                ? 'One complete standalone video.'
                : `AI writes a full ${numParts}-episode story arc and generates all parts sequentially. Each part auto-saves as it finishes.`}
            </p>
            <div className="flex gap-3">
              {PART_OPTIONS.map(({ value, label, sub }) => (
                <button
                  key={value}
                  onClick={() => setNumParts(value)}
                  className={`flex-1 flex flex-col items-center py-3 px-2 rounded-2xl border-2 font-bold transition-all duration-200 hover:scale-105 cursor-pointer ${
                    numParts === value
                      ? 'border-primary bg-primary/5 text-primary scale-105 shadow-md'
                      : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-xl">{label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-70">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <ThemeSelector value={theme} onChange={setTheme} />
        </section>
        <section>
          <SubtitleStyleSelector value={subtitleStyle} onChange={setSubtitleStyle} />
        </section>
        <section>
          <SettingsSelectors
            duration={durationTier}
            onDurationChange={setDurationTier}
            language={language}
            onLanguageChange={setLanguage}
          />
        </section>

        <div className="flex justify-center pt-4">
          <button
            onClick={handleGenerate}
            disabled={!idea.trim()}
            className="group relative flex items-center justify-center gap-3 bg-foreground text-background px-10 py-5 rounded-full text-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary hover:text-white hover:scale-105 shadow-xl hover:shadow-primary/30 cursor-pointer"
          >
            <span>{numParts > 1 ? `Produce ${numParts}-Part Series` : 'Produce Short'}</span>
            <Play className="w-6 h-6 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProgressScreen ───────────────────────────────────────────────────────────

function ProgressScreen({
  pipeline,
  onCancel,
}: {
  pipeline: ReturnType<typeof useVideoPipeline>;
  onCancel: () => void;
}) {
  const { progress, isRunning, isSeries, currentPart, totalParts, completedParts } = pipeline;
  if (!progress) return null;

  const isError = progress.stage === 'error';

  const stages = [
    { id: isSeries ? 'planning_series' : 'writing_story', label: isSeries ? 'Planning Series' : 'Writing Script' },
    { id: 'generating_voice_and_images', label: 'Voice & Imagery' },
    { id: 'timing_sync', label: 'Syncing Audio' },
    { id: 'assembling_video', label: 'Assembling Video' },
    { id: 'done', label: 'Finishing Touches' },
  ];

  const currentStageIndex = stages.findIndex((s) => s.id === progress.stage);

  return (
    <div className="max-w-2xl mx-auto py-20 animate-in fade-in duration-700">
      <div className="bg-white rounded-3xl p-10 md:p-14 shadow-xl border border-black/[0.04] text-center relative overflow-hidden">
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 blur-3xl opacity-20 -z-10 transition-colors duration-1000 ${
            isError ? 'bg-destructive' : 'bg-primary animate-pulse-slow'
          }`}
        />

        {isError ? (
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 text-destructive mb-4 animate-bounce">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-display font-bold animate-in slide-in-from-top-1 duration-300">Generation Failed</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              {progress.errorMessage || 'Something went wrong during production.'}
            </p>
            {isSeries && completedParts.length > 0 && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">
                {completedParts.length} part{completedParts.length > 1 ? 's were' : ' was'} completed and saved to your library before the error.
              </p>
            )}
            <div className="pt-6">
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full font-bold hover:bg-foreground/80 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Series part indicators */}
            {isSeries && (
              <div className="flex items-center justify-center gap-2 flex-wrap animate-in fade-in duration-500">
                {Array.from({ length: totalParts }).map((_, i) => {
                  const partNum = i + 1;
                  const isDone = partNum < currentPart || !isRunning;
                  const isActive = partNum === currentPart && isRunning;
                  return (
                     <div
                      key={i}
                      className={`flex items-center justify-center rounded-full font-bold text-sm transition-all duration-500 ${
                        isDone
                          ? 'w-9 h-9 bg-primary text-white shadow-md shadow-primary/30'
                          : isActive
                          ? 'w-10 h-10 bg-primary/20 text-primary border-2 border-primary ring-4 ring-primary/10 animate-pulse'
                          : 'w-9 h-9 bg-muted text-muted-foreground'
                      }`}
                    >
                      {isDone && !isActive ? '✓' : partNum}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Circular progress */}
            <div className="space-y-4">
              <div className="relative inline-flex items-center justify-center w-24 h-24">
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="48"
                    fill="none"
                    className="stroke-primary transition-all duration-1000 ease-out"
                    strokeWidth="4"
                    strokeDasharray="301.59"
                    strokeDashoffset={301.59 - (301.59 * progress.overallPercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-2xl font-bold">{Math.round(progress.overallPercent)}%</span>
              </div>

              <h2 className="text-3xl font-display font-bold">
                {isSeries
                  ? `Part ${Math.min(currentPart, totalParts)} of ${totalParts}`
                  : (stages.find((s) => s.id === progress.stage)?.label ?? 'Processing…')}
              </h2>
              <p className="text-lg text-muted-foreground animate-pulse">{progress.detail}</p>
            </div>

            {/* Stage list */}
            <div className="space-y-4 relative max-w-xs mx-auto text-left">
              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-muted -z-10" />
              {stages.map((stage, idx) => {
                const isActive = idx === currentStageIndex;
                const isPassed = idx < currentStageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-4 transition-all duration-500 ${
                      isActive ? 'opacity-100 scale-105' : isPassed ? 'opacity-50' : 'opacity-30'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        isActive
                          ? 'bg-primary text-white shadow-lg shadow-primary/30'
                          : isPassed
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`font-medium ${isActive ? 'text-lg text-foreground font-bold' : 'text-foreground'}`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ResultScreen (single video only) ─────────────────────────────────────────

function ResultScreen({
  pipeline,
  onNew,
  onPlay,
}: {
  pipeline: ReturnType<typeof useVideoPipeline>;
  onNew: () => void;
  onPlay: (v: GeneratedVideo) => void;
}) {
  const { result } = pipeline;
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');

  useEffect(() => {
    if (!result) return;
    const vUrl = URL.createObjectURL(result.videoBlob);
    const pUrl = URL.createObjectURL(result.posterBlob);
    const t = setTimeout(() => {
      setVideoUrl(vUrl);
      setPosterUrl(pUrl);
    }, 0);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(vUrl);
      URL.revokeObjectURL(pUrl);
    };
  }, [result]);

  if (!result || !videoUrl || !posterUrl) return null;

  const handleDownload = () => {
    const ext = result.videoBlob.type.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${result.title}.${ext}`;
    a.click();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col md:flex-row gap-10">
        {/* Phone Mockup Player */}
        <div className="flex-shrink-0 mx-auto md:mx-0 w-[320px] lg:w-[380px]">
          <div className="relative aspect-[9/16] bg-black rounded-[2.5rem] shadow-2xl overflow-hidden border-[8px] border-slate-900 group">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-900 rounded-b-xl z-20" />
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl}
              className="w-full h-full object-cover"
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div
              className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-300 cursor-pointer ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
              onClick={togglePlay}
            >
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg">
                {isPlaying
                  ? <div className="w-6 h-6 border-l-4 border-r-4 border-white" />
                  : <Play className="w-8 h-8 fill-current ml-1" />}
              </div>
            </div>
          </div>
        </div>

        {/* Details & Actions */}
        <div className="flex-1 flex flex-col justify-center space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold mb-4 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Ready
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight mb-4">
              {result.title}
            </h1>
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">
                {THEMES.find((t) => t.id === result.theme)?.label}
              </span>
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">
                {SUBTITLE_STYLES.find((t) => t.id === result.subtitleStyle)?.label}
              </span>
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">
                {VOICE_LANGUAGES.find((t) => t.code === result.language)?.label}
              </span>
              <span className="px-3 py-1 bg-muted rounded-md text-sm font-medium">
                {formatDuration(result.durationSec)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background px-6 py-4 rounded-xl font-bold text-lg hover:bg-foreground/80 transition-all hover:-translate-y-1 shadow-lg cursor-pointer"
            >
              <Download className="w-6 h-6" />
              Download
            </button>
            <button
              onClick={() => onPlay(result)}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all hover:-translate-y-1 shadow-lg cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              Full Screen
            </button>
            <button
              onClick={onNew}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-foreground border-2 border-border px-6 py-4 rounded-xl font-bold text-lg hover:bg-muted transition-all hover:-translate-y-1 shadow-sm cursor-pointer"
            >
              <Plus className="w-6 h-6" />
              Create Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HistoryScreen ────────────────────────────────────────────────────────────

function HistoryScreen({
  historyHook,
  onPlay,
  pipeline,
}: {
  historyHook: ReturnType<typeof useVideoHistory>;
  onPlay: (v: GeneratedVideo) => void;
  pipeline: ReturnType<typeof useVideoPipeline>;
}) {
  const { videos, isLoading, removeVideo } = historyHook;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading library...</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-32 animate-in fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted text-muted-foreground mb-6 animate-pulse">
          <Film className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-display font-bold mb-4">Your library is empty</h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8">
          Videos you create will be saved here automatically.
          {pipeline.isRunning && ' Your video is generating right now!'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-4 rounded-full font-bold hover:scale-105 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Create Your First Video
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 animate-in fade-in">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-display font-bold tracking-tight">Library</h1>
        <span className="text-muted-foreground font-medium bg-muted px-4 py-1.5 rounded-full">
          {videos.length} {videos.length === 1 ? 'Video' : 'Videos'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onPlay={onPlay}
            onDelete={removeVideo}
          />
        ))}
      </div>
    </div>
  );
}

function VideoCard({
  video,
  onPlay,
  onDelete,
}: {
  video: GeneratedVideo;
  onPlay: (v: GeneratedVideo) => void;
  onDelete: (id: string) => void;
}) {
  const [posterUrl, setPosterUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(video.posterBlob);
    const t = setTimeout(() => {
      setPosterUrl(url);
    }, 0);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(url);
    };
  }, [video.posterBlob]);

  const handleDownload = () => {
    const ext = video.videoBlob.type.includes('webm') ? 'webm' : 'mp4';
    const url = URL.createObjectURL(video.videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.title}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isSeries = !!video.seriesId && (video.totalParts ?? 1) > 1;

  if (!posterUrl) return null;

  return (
    <div className="group flex flex-col bg-card rounded-2xl overflow-hidden border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300">
      <div className="relative aspect-[9/16] bg-slate-900 overflow-hidden">
        <img
          src={posterUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

        {/* Series badge */}
        {isSeries && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 shadow-md">
            <Layers className="w-3 h-3" />
            {video.partNumber}/{video.totalParts}
          </div>
        )}

        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(video.id);
            }}
            className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-destructive transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Play / Download on hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onPlay(video)}
            className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center backdrop-blur-md hover:bg-primary/80 transition-colors shadow-xl cursor-pointer"
            title="Play"
          >
            <Play className="w-6 h-6 fill-current ml-1" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md hover:bg-white/30 transition-colors shadow-xl cursor-pointer"
            title="Download"
          >
            <Download className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-bold text-white">
          {formatDuration(video.durationSec)}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 cursor-pointer" onClick={() => onPlay(video)}>
        <h3 className="font-bold text-base mb-2 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        <div className="mt-auto space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded">
              {THEMES.find((t) => t.id === video.theme)?.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded">
              {VOICE_LANGUAGES.find((t) => t.code === video.language)?.label}
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            {new Date(video.createdAt).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Background generation banner ─────────────────────────────────────────────

function BackgroundBanner({ pipeline }: { pipeline: ReturnType<typeof useVideoPipeline> }) {
  const [location] = useLocation();
  const [lastCompletedCount, setLastCompletedCount] = useState(0);
  const [justCompleted, setJustCompleted] = useState<number | null>(null);

  useEffect(() => {
    if (pipeline.completedParts.length > lastCompletedCount && lastCompletedCount > 0) {
      const t = setTimeout(() => {
        setJustCompleted(pipeline.completedParts.length);
      }, 0);
      const timer = setTimeout(() => {
        setJustCompleted(null);
      }, 3000);
      const t2 = setTimeout(() => {
        setLastCompletedCount(pipeline.completedParts.length);
      }, 0);
      return () => {
        clearTimeout(t);
        clearTimeout(timer);
        clearTimeout(t2);
      };
    }
    const t = setTimeout(() => {
      setLastCompletedCount(pipeline.completedParts.length);
    }, 0);
    return () => clearTimeout(t);
  }, [pipeline.completedParts.length, lastCompletedCount]);

  // Only show on library page while generating
  if (!pipeline.isRunning || location === '/') return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Link href="/">
        <div className="flex items-center gap-3 bg-foreground text-background px-6 py-3 rounded-full shadow-2xl hover:bg-foreground/80 transition-colors cursor-pointer">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          {justCompleted ? (
            <span className="font-semibold text-sm">
              ✓ Part {justCompleted} saved!{' '}
              {pipeline.currentPart <= pipeline.totalParts
                ? `Generating Part ${pipeline.currentPart}…`
                : ''}
            </span>
          ) : pipeline.isSeries ? (
            <span className="font-semibold text-sm">
              Generating Part {Math.min(pipeline.currentPart, pipeline.totalParts)} of {pipeline.totalParts}…
            </span>
          ) : (
            <span className="font-semibold text-sm">Generating your video…</span>
          )}
          <span className="text-xs text-background/50 border-l border-background/20 pl-3">Tap to view</span>
        </div>
      </Link>
    </div>
  );
}

// ─── Layout & Routing ─────────────────────────────────────────────────────────

function AppLayout({
  children,
  pipeline,
}: {
  children: React.ReactNode;
  pipeline: ReturnType<typeof useVideoPipeline>;
}) {
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              Studio<span className="text-primary">.ai</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className={`font-semibold text-sm transition-colors hover:text-primary ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Create
            </Link>
            <Link
              href="/library"
              className={`font-semibold text-sm flex items-center gap-2 transition-colors hover:text-primary ${location === '/library' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <History className="w-4 h-4" />
              Library
              {pipeline.isRunning && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pt-10">{children}</main>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function AppContent() {
  const pipeline = useVideoPipeline();
  const historyHook = useVideoHistory();
  const [playingVideo, setPlayingVideo] = useState<GeneratedVideo | null>(null);

  const handleStart = (input: GenerationInput) => {
    pipeline.start(input, (video) => {
      historyHook.addVideo(video);
    });
  };

  const handleNew = () => {
    pipeline.reset();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base="">
        <AppLayout pipeline={pipeline}>
          <Switch>
            <Route path="/">
              {() => {
                // Series finished → go to library (all parts already saved)
                // For single video: show result screen
                if (!pipeline.isRunning && pipeline.isSeries && pipeline.completedParts.length > 0 && pipeline.progress?.stage === 'done') {
                  return (
                    <div className="max-w-2xl mx-auto py-20 text-center animate-in fade-in duration-700">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6">
                        <Layers className="w-10 h-10" />
                      </div>
                      <h2 className="text-4xl font-display font-bold mb-4">Series Complete!</h2>
                      <p className="text-lg text-muted-foreground mb-2">
                        {pipeline.completedParts.length} episodes generated and saved to your library.
                      </p>
                      <p className="text-muted-foreground mb-10">
                        {pipeline.completedParts[0]?.seriesTitle}
                      </p>
                      <div className="flex justify-center gap-4 flex-wrap">
                        <Link
                          href="/library"
                          onClick={handleNew}
                          className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-full font-bold hover:bg-primary/90 hover:scale-105 transition-all shadow-lg"
                        >
                          <Film className="w-5 h-5" />
                          View in Library
                        </Link>
                        <button
                          onClick={handleNew}
                          className="inline-flex items-center gap-2 bg-white border-2 border-border text-foreground px-8 py-4 rounded-full font-bold hover:bg-muted transition-all shadow-sm cursor-pointer"
                        >
                          <Plus className="w-5 h-5" />
                          Create Another
                        </button>
                      </div>
                    </div>
                  );
                }

                if (pipeline.result && !pipeline.isSeries) {
                  return (
                    <ResultScreen
                      pipeline={pipeline}
                      onNew={handleNew}
                      onPlay={setPlayingVideo}
                    />
                  );
                }

                if (pipeline.isRunning || (pipeline.progress && pipeline.progress.stage !== 'done')) {
                  return <ProgressScreen pipeline={pipeline} onCancel={handleNew} />;
                }

                return <CreateScreen onGenerate={handleStart} />;
              }}
            </Route>

            <Route path="/library">
              {() => (
                <HistoryScreen
                  historyHook={historyHook}
                  onPlay={setPlayingVideo}
                  pipeline={pipeline}
                />
              )}
            </Route>

            <Route>
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <h2 className="text-4xl font-display font-bold mb-4">404 - Not Found</h2>
                <p className="text-muted-foreground mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
                <Link href="/" className="text-primary font-bold hover:underline">Return Home</Link>
              </div>
            </Route>
          </Switch>
        </AppLayout>

        {/* Background generation banner (shows on /library while generating) */}
        <BackgroundBanner pipeline={pipeline} />

        {/* In-app player overlay */}
        {playingVideo && (
          <VideoPlayerOverlay video={playingVideo} onClose={() => setPlayingVideo(null)} />
        )}
      </WouterRouter>
    </QueryClientProvider>
  );
}

const App = dynamic(() => Promise.resolve(AppContent), { ssr: false });
export default App;

