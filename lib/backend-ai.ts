import { GoogleGenAI, Type, Modality } from "@google/genai";
import { synthesizeSpeech, MAGPIE_LANGUAGES } from "./rivaTtsClient";
import { pcm16ToWav, pcm16DurationSec } from "./wav";

const NVIDIA_INTEGRATE_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";
const STORY_MODEL = "meta/llama-3.1-70b-instruct";

// ─── Gemini Client Setup ──────────────────────────────────────────────────────

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// ─── Theme Style Keywords ────────────────────────────────────────────────────

export const THEME_STYLE_KEYWORDS: Record<string, string> = {
  anime: "anime style, cel shaded, vibrant anime illustration, studio anime key art",
  cartoon: "modern cartoon illustration, bold outlines, flat vibrant colors, playful cartoon style",
  cinematic_realistic: "cinematic photorealistic, dramatic film lighting, shallow depth of field, movie still",
  fantasy_mythical: "epic fantasy illustration, mythical, painterly, dramatic magical lighting",
  dark_horror: "dark horror atmosphere, moody shadows, unsettling lighting, gothic horror illustration",
  pixel_art_retro: "16-bit pixel art, retro video game sprite style, limited color palette",
  storybook_watercolor: "storybook watercolor illustration, soft brush textures, whimsical children's book art",
};

// ─── Unified LLM Call (Nvidia / Gemini) ───────────────────────────────────────

export async function generateText(params: {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const hasNvidia = !!process.env.NVIDIA_API_KEY;

  if (hasNvidia) {
    try {
      console.log("[AI] Using NVIDIA LLM:", STORY_MODEL);
      const res = await fetch(`${NVIDIA_INTEGRATE_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: STORY_MODEL,
          messages: [
            { role: "system", content: params.systemInstruction },
            { role: "user", content: params.userPrompt },
          ],
          temperature: params.temperature ?? 0.8,
          max_tokens: 2500,
          stream: false,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`NVIDIA LLM Error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err) {
      console.warn("[AI] NVIDIA LLM call failed, falling back to Gemini:", err);
    }
  }

  // Fallback / default to Gemini
  console.log("[AI] Using Gemini LLM: gemini-3.5-flash");
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature ?? 0.8,
      responseMimeType: "application/json",
    },
  });

  return response.text || "";
}

// ─── Unified Image Call (Nvidia / Gemini) ─────────────────────────────────────

export async function generateImage(params: {
  prompt: string;
  theme: string;
  seed: number;
}): Promise<{ base64: string; seed: number }> {
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const styleKeywords = THEME_STYLE_KEYWORDS[params.theme] ?? "";
  const fullPrompt = `${params.prompt}, ${styleKeywords}, vertical portrait composition, highly detailed`;

  if (hasNvidia) {
    try {
      console.log("[AI] Using NVIDIA Flux Image Generator");
      const res = await fetch(`${NVIDIA_GENAI_BASE}/black-forest-labs/flux.1-dev`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          width: 768,
          height: 1344,
          cfg_scale: 5,
          mode: "base",
          samples: 1,
          seed: params.seed,
          steps: 40, // standard steps for high quality Flux
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`NVIDIA Image Error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as {
        artifacts?: Array<{ base64: string; seed: number; finishReason: string }>;
      };
      const art = data.artifacts?.[0];
      if (art && art.base64 && art.finishReason === "SUCCESS") {
        return { base64: art.base64, seed: art.seed };
      }
    } catch (err) {
      console.warn("[AI] NVIDIA Image call failed, falling back to Gemini:", err);
    }
  }

  // Fallback to Gemini Image Generation
  console.log("[AI] Using Gemini Image: gemini-3.1-flash-lite-image");
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-image",
    contents: fullPrompt,
    config: {
      imageConfig: {
        aspectRatio: "9:16",
      },
    },
  });

  // Extract base64 image data from Gemini candidate parts
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return {
          base64: part.inlineData.data,
          seed: params.seed,
        };
      }
    }
  }

  throw new Error("No image data found in Gemini generation response");
}

// ─── Unified Speech Call (Nvidia / Gemini) ────────────────────────────────────

export async function generateSpeech(params: {
  text: string;
  language: string;
}): Promise<{ base64: string; durationSec: number }> {
  const hasNvidia = !!process.env.NVIDIA_API_KEY;
  const voiceConfig = MAGPIE_LANGUAGES[params.language];

  if (hasNvidia && voiceConfig) {
    try {
      console.log("[AI] Using NVIDIA Riva gRPC Speech Synthesis:", voiceConfig.voiceName);
      const sampleRateHz = 24000;
      const { audio } = await synthesizeSpeech({
        text: params.text,
        languageCode: voiceConfig.locale,
        voiceName: voiceConfig.voiceName,
        sampleRateHz,
      });

      const wav = pcm16ToWav(audio, sampleRateHz);
      const durationSec = pcm16DurationSec(audio, sampleRateHz);

      return {
        base64: wav.toString("base64"),
        durationSec,
      };
    } catch (err) {
      console.warn("[AI] NVIDIA Riva gRPC failed, falling back to Gemini TTS:", err);
    }
  }

  // Fallback / default to Gemini TTS
  console.log("[AI] Using Gemini TTS: gemini-3.1-flash-tts-preview");
  const ttsPrompt = `Say clearly in native speaker voice: ${params.text}`;

  // Select appropriate prebuilt voice based on language vibe if possible
  const defaultVoices = ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"];
  const voiceName = defaultVoices[Math.floor(Math.random() * defaultVoices.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: ttsPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Gemini TTS did not return any audio data");
  }

  // To calculate duration for Gemini's 24kHz raw audio returned:
  // Convert base64 to bytes to estimate length
  const byteLength = Buffer.from(base64Audio, "base64").length;
  // Gemini's TTS model returns 24kHz PCM linear audio (2 bytes per sample, 1 channel)
  const durationSec = byteLength / 2 / 24000;

  return {
    base64: base64Audio,
    durationSec,
  };
}
