/**
 * Series pipeline — generates multiple video episodes from a single story arc.
 *
 * Flow:
 *   1. POST /api/generate-series-story  → full multi-part script
 *   2. For each part (sequentially):
 *      a. Throttled parallel voice + image generation per scene
 *      b. Canvas frame rendering
 *      c. Native MediaRecorder assembly
 *      d. onPartComplete callback (caller saves to history)
 */
import { generateVoice, generateImage } from './apiClient';
import type { GenerationInput, GeneratedVideo, OnProgress } from "./types";
import { renderSceneFrames, renderPosterFrame } from "./renderFrames";
import { concatWavBuffers, base64ToUint8Array } from "./audioConcat";
import { assembleVideoNative } from "./nativeAssemble";

const MAX_CONCURRENT_SCENES = 3;

async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function decodeImageBase64(base64: string): Promise<ImageBitmap> {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes.slice().buffer], { type: "image/jpeg" });
  return createImageBitmap(blob);
}

type SeriesScene = {
  sceneNumber: number;
  narrationSegment: string;
  imagePrompt: string;
  mood?: string;
};

type SeriesPart = {
  partNumber: number;
  title: string;
  scenes: SeriesScene[];
};

type SeriesStory = {
  seriesTitle: string;
  characterSheet: string;
  parts: SeriesPart[];
};

export async function runSeriesPipeline(
  input: GenerationInput & { numParts: number },
  onProgress: OnProgress,
  onPartComplete: (video: GeneratedVideo, partNumber: number, totalParts: number) => void
): Promise<GeneratedVideo[]> {
  const { theme, subtitleStyle, language, durationTier, idea, numParts } = input;

  // ── Stage 1: Generate full series story ─────────────────────────────────
  onProgress({
    stage: "planning_series",
    overallPercent: 2,
    detail: `Planning ${numParts}-part story arc…`,
  });

  const storyRes = await fetch("/api/generate-series-story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, numParts, durationTier, language, theme }),
  });

  if (!storyRes.ok) {
    const errData = (await storyRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error ?? `Series story generation failed (HTTP ${storyRes.status})`);
  }

  const story = (await storyRes.json()) as SeriesStory;

  if (!story.parts || story.parts.length === 0) {
    throw new Error("Series story returned no parts. Please try again.");
  }

  const completedVideos: GeneratedVideo[] = [];
  const seriesId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1_000_000_000);

  // ── Stages 2-N: Generate each part sequentially ──────────────────────────
  for (let partIdx = 0; partIdx < story.parts.length; partIdx++) {
    const part = story.parts[partIdx];
    const partNum = partIdx + 1;
    const totalParts = story.parts.length;

    // Overall progress slice for this part: 10% planning + 90% spread over parts
    const partSliceStart = 10 + (partIdx / totalParts) * 90;
    const partSliceEnd = 10 + ((partIdx + 1) / totalParts) * 90;
    const partSlice = partSliceEnd - partSliceStart;

    const voiceAndImageEnd = partSliceStart + partSlice * 0.6;
    const renderEnd = partSliceStart + partSlice * 0.85;

    onProgress({
      stage: "generating_voice_and_images",
      overallPercent: Math.round(partSliceStart),
      detail: `Part ${partNum}/${totalParts}: generating voice & artwork…`,
    });

    let completedUnits = 0;
    const totalUnits = part.scenes.length * 2;

    type SceneResult = {
      scene: SeriesScene;
      voiceBase64: string;
      durationSec: number;
      imageBase64: string;
    };
    const sceneResults: SceneResult[] = new Array(part.scenes.length);

    await runWithConcurrencyLimit(part.scenes, MAX_CONCURRENT_SCENES, async (scene: any, i) => {
      const [voice, image] = await Promise.all([
        generateVoice({ text: scene.narrationSegment, language }).then((r) => {
          completedUnits++;
          onProgress({
            stage: "generating_voice_and_images",
            overallPercent: Math.round(
              partSliceStart + (completedUnits / totalUnits) * (voiceAndImageEnd - partSliceStart)
            ),
            detail: `Part ${partNum}/${totalParts}: scene ${Math.ceil(completedUnits / 2)}/${part.scenes.length}`,
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
            stage: "generating_voice_and_images",
            overallPercent: Math.round(
              partSliceStart + (completedUnits / totalUnits) * (voiceAndImageEnd - partSliceStart)
            ),
            detail: `Part ${partNum}/${totalParts}: scene ${Math.ceil(completedUnits / 2)}/${part.scenes.length}`,
          });
          return r;
        }),
      ]);
      sceneResults[i] = {
        scene,
        voiceBase64: voice.audioBase64,
        durationSec: voice.durationSec,
        imageBase64: image.imageBase64,
      };
    });

    // ── Render frames ──────────────────────────────────────────────────────
    onProgress({
      stage: "assembling_video",
      overallPercent: Math.round(voiceAndImageEnd),
      detail: `Part ${partNum}/${totalParts}: rendering caption frames…`,
    });

    type RenderedFrameLocal = Awaited<ReturnType<typeof renderSceneFrames>>[number];
    const allFrames: RenderedFrameLocal[] = [];
    let posterBlob: Blob | null = null;

    const audioBuffers = sceneResults.map((r) => base64ToUint8Array(r.voiceBase64));
    const combinedAudio = concatWavBuffers(audioBuffers);
    const totalDurationSec = sceneResults.reduce((sum, r) => sum + r.durationSec, 0);

    for (let i = 0; i < sceneResults.length; i++) {
      const { scene, imageBase64, durationSec } = sceneResults[i];
      const bitmap = await decodeImageBase64(imageBase64);
      if (i === 0) posterBlob = await renderPosterFrame(bitmap);

      const frames = await renderSceneFrames({
        image: bitmap,
        narrationSegment: scene.narrationSegment,
        sceneDurationSec: durationSec,
        subtitleStyle,
      });
      allFrames.push(...frames);
      bitmap.close();

      onProgress({
        stage: "assembling_video",
        overallPercent: Math.round(
          voiceAndImageEnd + ((i + 1) / sceneResults.length) * (renderEnd - voiceAndImageEnd)
        ),
        detail: `Part ${partNum}/${totalParts}: frames (${i + 1}/${sceneResults.length})…`,
      });
    }

    // ── Encode video ───────────────────────────────────────────────────────
    onProgress({
      stage: "assembling_video",
      overallPercent: Math.round(renderEnd),
      detail: `Part ${partNum}/${totalParts}: encoding video…`,
    });

    const videoBlob = await assembleVideoNative({
      frames: allFrames,
      audioWav: combinedAudio,
      onProgress: (ratio) => {
        onProgress({
          stage: "assembling_video",
          overallPercent: Math.round(renderEnd + ratio * (partSliceEnd - renderEnd)),
          detail: `Part ${partNum}/${totalParts}: encoding…`,
        });
      },
    });

    if (!posterBlob) throw new Error("Failed to render poster frame");

    const video: GeneratedVideo = {
      id: crypto.randomUUID(),
      title: `${story.seriesTitle} — Part ${partNum}`,
      theme,
      subtitleStyle,
      language,
      durationTier,
      durationSec: totalDurationSec,
      createdAt: Date.now(),
      videoBlob,
      posterBlob,
      seriesId,
      seriesTitle: story.seriesTitle,
      partNumber: partNum,
      totalParts,
    };

    completedVideos.push(video);
    onPartComplete(video, partNum, totalParts);
  }

  onProgress({ stage: "done", overallPercent: 100, detail: "All parts ready!" });
  return completedVideos;
}
