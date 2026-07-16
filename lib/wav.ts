/** Wraps raw 16-bit signed little-endian PCM samples in a WAV container. */
export function pcm16ToWav(
  pcm: Buffer,
  sampleRateHz: number,
  numChannels = 1,
): Buffer {
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRateHz * blockAlign;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

/** Duration in seconds of 16-bit PCM audio at the given sample rate. */
export function pcm16DurationSec(
  pcm: Buffer,
  sampleRateHz: number,
  numChannels = 1,
): number {
  const bytesPerSample = 2 * numChannels;
  return pcm.length / bytesPerSample / sampleRateHz;
}
