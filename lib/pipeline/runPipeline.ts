import { generateStory, generateVoice, generateImage } from './apiClient';
import type { GenerationInput, GeneratedVideo, OnProgress } from './types';
import { renderSceneFrames, renderPosterFrame } from './renderFrames';
import { concatWavBuffers, base64ToUint8Array } from './audioConcat';
import { assembleVideoNative } from './nativeAssemble';

// Run at most N scenes concurrently to avoid NVIDIA rate-limiting.
const MAX_CONCURRENT_SCENES = 3;

async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
}

async function decodeImageBase64(base64: string): Promise<ImageBitmap> {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes.slice().buffer], { type: 'image/jpeg' });
  return createImageBitmap(blob);
}

/**
 * Runs the full end-to-end generation pipeline:
 *   story (LLM) → per-scene voice + images (parallel, throttled) →
 *   canvas frame rendering → native MediaRecorder assembly
 *
 * Assembly uses the browser's own hardware video encoder — no WASM,
 * no COOP/COEP headers required.
 */
export async function runGenerationPipeline(
  input: GenerationInput,
  onProgress: OnProgress,
): Promise<GeneratedVideo> {
  const { theme, subtitleStyle, idea, language, durationTier } = input;

  // ── Stage 1: Story ──────────────────────────────────────────────────────
  onProgress({ stage: 'writing_story', overallPercent: 2, detail: 'Writing your story…' });

  const story = await generateStory({ idea, language, durationTier, theme });

  // ── Stage 2: Voice + Images (throttled parallel) ────────────────────────
  onProgress({
    stage: 'generating_voice_and_images',
    overallPercent: 12,
    detail: `Generating narration & artwork for ${story.scenes.length} scenes…`,
  });

  const seed = Math.floor(Math.random() * 1_000_000_000);
  let completedUnits = 0;
  const totalUnits = story.scenes.length * 2; // voice + image per scene

  type SceneResult = {
    scene: (typeof story.scenes)[0];
    voiceBase64: string;
    durationSec: number;
    imageBase64: string;
  };
  const results: SceneResult[] = new Array(story.scenes.length);

  await runWithConcurrencyLimit(story.scenes, MAX_CONCURRENT_SCENES, async (scene: any, i) => {
    const [voice, image] = await Promise.all([
      generateVoice({ text: scene.narrationSegment, language }).then((r) => {
        completedUnits++;
        onProgress({
          stage: 'generating_voice_and_images',
          overallPercent: Math.round(12 + (completedUnits / totalUnits) * 58),
          detail: `Voice & art: scene ${Math.ceil(completedUnits / 2)} / ${story.scenes.length}`,
        });
        return r;
      }),
      generateImage({
        prompt: `${story.characterSheet}. ${scene.imagePrompt}`,
        theme,
        seed,
      }).then((r) => {
        completedUnits++;
        onProgress({
          stage: 'generating_voice_and_images',
          overallPercent: Math.round(12 + (completedUnits / totalUnits) * 58),
          detail: `Voice & art: scene ${Math.ceil(completedUnits / 2)} / ${story.scenes.length}`,
        });
        return r;
      }),
    ]);
    results[i] = {
      scene,
      voiceBase64: voice.audioBase64,
      durationSec: voice.durationSec,
      imageBase64: image.imageBase64,
    };
  });

  // ── Stage 3: Timing sync ────────────────────────────────────────────────
  onProgress({ stage: 'timing_sync', overallPercent: 72, detail: 'Syncing captions to audio…' });

  const audioBuffers = results.map((r) => base64ToUint8Array(r.voiceBase64));
  const combinedAudio = concatWavBuffers(audioBuffers);
  const totalDurationSec = results.reduce((sum, r) => sum + r.durationSec, 0);

  // ── Stage 4: Render frames ─────────────────────────────────────────────
  onProgress({ stage: 'assembling_video', overallPercent: 74, detail: 'Rendering caption frames…' });

  type RenderedFrameLocal = Awaited<ReturnType<typeof renderSceneFrames>>[number];
  const allFrames: RenderedFrameLocal[] = [];
  let posterBlob: Blob | null = null;

  for (let i = 0; i < results.length; i++) {
    const { scene, imageBase64, durationSec } = results[i];
    const bitmap = await decodeImageBase64(imageBase64);

    if (i === 0) {
      posterBlob = await renderPosterFrame(bitmap);
    }

    const frames = await renderSceneFrames({
      image: bitmap,
      narrationSegment: scene.narrationSegment,
      sceneDurationSec: durationSec,
      subtitleStyle,
    });
    allFrames.push(...frames);
    bitmap.close();

    onProgress({
      stage: 'assembling_video',
      overallPercent: Math.round(74 + ((i + 1) / results.length) * 14),
      detail: `Rendering frames (${i + 1}/${results.length})…`,
    });
  }

  // ── Stage 5: Encode video ──────────────────────────────────────────────
  onProgress({ stage: 'assembling_video', overallPercent: 89, detail: 'Encoding video (native)…' });

  const videoBlob = await assembleVideoNative({
    frames: allFrames,
    audioWav: combinedAudio,
    onProgress: (ratio) => {
      onProgress({
        stage: 'assembling_video',
        overallPercent: Math.round(89 + ratio * 10),
        detail: 'Encoding video…',
      });
    },
  });

  onProgress({ stage: 'done', overallPercent: 100, detail: 'Done!' });

  if (!posterBlob) throw new Error('Failed to render poster frame');

  return {
    id: crypto.randomUUID(),
    title: story.title,
    theme,
    subtitleStyle,
    language,
    durationTier,
    durationSec: totalDurationSec,
    createdAt: Date.now(),
    videoBlob,
    posterBlob,
  };
}
