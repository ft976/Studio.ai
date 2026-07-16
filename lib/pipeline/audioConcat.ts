/** Minimal WAV parsing/writing for concatenating same-format PCM clips. */

interface WavData {
  sampleRateHz: number;
  numChannels: number;
  bitsPerSample: number;
  pcm: Uint8Array;
}

function parseWav(bytes: Uint8Array): WavData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, false) !== 0x52494646 || // "RIFF"
    view.getUint32(8, false) !== 0x57415645 // "WAVE"
  ) {
    throw new Error('Not a valid WAV file');
  }

  let offset = 12;
  let sampleRateHz = 0;
  let numChannels = 1;
  let bitsPerSample = 16;
  let pcm: Uint8Array | null = null;

  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(dataStart + 2, true);
      sampleRateHz = view.getUint32(dataStart + 4, true);
      bitsPerSample = view.getUint16(dataStart + 14, true);
    } else if (chunkId === 'data') {
      pcm = bytes.subarray(dataStart, dataStart + chunkSize);
    }

    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  if (!pcm) throw new Error('WAV file has no data chunk');
  return { sampleRateHz, numChannels, bitsPerSample, pcm };
}

function writeWavHeader(dataSize: number, sampleRateHz: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRateHz * blockAlign;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return new Uint8Array(buffer);
}

/** Concatenates multiple same-format WAV byte buffers into one WAV buffer. */
export function concatWavBuffers(buffers: Uint8Array[]): Uint8Array {
  if (buffers.length === 0) throw new Error('No audio buffers to concatenate');
  const parsed = buffers.map(parseWav);

  const { sampleRateHz, numChannels, bitsPerSample } = parsed[0];
  for (const p of parsed) {
    if (p.sampleRateHz !== sampleRateHz || p.numChannels !== numChannels || p.bitsPerSample !== bitsPerSample) {
      throw new Error('Cannot concatenate WAV buffers with mismatched formats');
    }
  }

  const totalPcmLength = parsed.reduce((sum, p) => sum + p.pcm.length, 0);
  const header = writeWavHeader(totalPcmLength, sampleRateHz, numChannels, bitsPerSample);

  const output = new Uint8Array(header.length + totalPcmLength);
  output.set(header, 0);
  let cursor = header.length;
  for (const p of parsed) {
    output.set(p.pcm, cursor);
    cursor += p.pcm.length;
  }

  return output;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
