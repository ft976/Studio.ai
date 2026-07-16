export async function generateStory(body: {
  idea: string;
  language: string;
  durationTier: string;
  theme: string;
  targetWordCountOverride?: number | null;
}): Promise<any> {
  const res = await fetch('/api/generate-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Story generation failed (HTTP ${res.status})`);
  }
  return res.json();
}

export async function generateVoice(body: {
  text: string;
  language: string;
}): Promise<any> {
  const res = await fetch('/api/generate-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Voice synthesis failed (HTTP ${res.status})`);
  }
  return res.json();
}

export async function generateImage(body: {
  prompt: string;
  theme: string;
  seed: number;
}): Promise<any> {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Image generation failed (HTTP ${res.status})`);
  }
  return res.json();
}
