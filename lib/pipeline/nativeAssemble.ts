/**
 * Native browser video assembly using MediaRecorder + canvas.captureStream().
 *
 * No WASM download, no SharedArrayBuffer / COOP-COEP headers required.
 * Uses the browser's own hardware-accelerated video encoder — typically
 * 20-50× faster than ffmpeg.wasm for short clips.
 *
 * Output: WebM (VP9 on Chrome/Firefox, H264 on Safari) — plays everywhere
 * and is downloadable as-is.
 */

import type { RenderedFrame } from './renderFrames';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from './renderFrames';

// Pick the best supported codec available in this browser.
function pickMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Assembles frames + audio into a video Blob using entirely browser-native APIs.
 *
 * @param frames   Pre-rendered JPEG blobs, each with a durationSec.
 * @param audioWav Raw WAV bytes (all scenes concatenated, mono 24 kHz 16-bit PCM).
 * @param onProgress Callback with 0-1 progress ratio.
 */
export async function assembleVideoNative(params: {
  frames: RenderedFrame[];
  audioWav: Uint8Array;
  onProgress?: (ratio: number) => void;
}): Promise<Blob> {
  const { frames, audioWav, onProgress } = params;

  // --- Decode all frame blobs → ImageBitmap up front ---
  const bitmaps = await Promise.all(frames.map((f) => createImageBitmap(f.blob)));

  // --- Set up canvas for recording ---
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // Draw the first frame immediately so captureStream sees something before start().
  ctx.drawImage(bitmaps[0], 0, 0);

  const videoStream = canvas.captureStream(30);

  // --- Set up audio via WebAudio ---
  const audioCtx = new AudioContext({ sampleRate: 24000 });
  const wavBuffer = audioWav.buffer.slice(
    audioWav.byteOffset,
    audioWav.byteOffset + audioWav.byteLength,
  );
  const audioBuffer = await audioCtx.decodeAudioData(wavBuffer as ArrayBuffer);

  const audioDestination = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioDestination);

  // --- Combine video + audio tracks ---
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ]);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(combined, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 128_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => reject(new Error(`MediaRecorder error: ${(e as Event & { error?: DOMException }).error?.message ?? 'unknown'}`));
  });

  // --- Start recording and audio ---
  recorder.start(100); // emit chunks every 100 ms
  source.start(0);

  // --- Animate frames ---
  const totalFrames = frames.length;
  for (let i = 0; i < totalFrames; i++) {
    const frame = frames[i];
    ctx.drawImage(bitmaps[i], 0, 0);
    bitmaps[i].close();
    onProgress?.((i + 1) / totalFrames);
    // Hold this frame for its duration (minus a small rendering overhead).
    await sleep(Math.max(frame.durationSec * 1000 - 4, 4));
  }

  // --- Stop and collect ---
  recorder.stop();
  source.stop();
  await audioCtx.close();
  await recordingDone;

  const finalMime = mimeType || 'video/webm';
  return new Blob(chunks, { type: finalMime });
}
