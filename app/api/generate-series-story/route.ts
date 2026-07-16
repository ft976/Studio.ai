import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/backend-ai";

const SCENE_COUNTS: Record<string, number> = {
  short: 9,
  long: 11,
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  fr: "French",
  vi: "Vietnamese",
  it: "Italian",
  zh: "Chinese (Mandarin)",
  hi: "Hindi",
  ja: "Japanese",
};

const THEME_LABELS: Record<string, string> = {
  anime: "anime style",
  cartoon: "cartoon / animation",
  cinematic_realistic: "cinematic realism",
  fantasy_mythical: "fantasy / mythical epic",
  dark_horror: "dark horror",
  pixel_art_retro: "retro pixel art game",
  storybook_watercolor: "storybook watercolor illustration",
  "3d_render_unreal": "high quality 3d render unreal engine",
  vintage_photography: "vintage analog photography",
  cyberpunk_neon: "cyberpunk neon sci-fi",
  oil_painting: "classic fine art oil painting",
  comic_book: "graphic novel comic book style",
};

function buildPrompt(
  idea: string,
  numParts: number,
  scenesPerPart: number,
  language: string,
  theme: string
): string {
  const langLabel = LANGUAGE_LABELS[language] ?? "English";
  const themeLabel = THEME_LABELS[theme] ?? "cinematic realism";
  const totalScenes = numParts * scenesPerPart;

  return `You are a master storyteller writing a serialized short-form video series.

IDEA: "${idea}"

Create a complete ${numParts}-part video series. Each part is a standalone episode (~${scenesPerPart * 7}-${scenesPerPart * 9} seconds) that advances the overall story arc.

REQUIREMENTS:
- Write ALL narration in ${langLabel}
- Visual style for image prompts: ${themeLabel}
- Each part has exactly ${scenesPerPart} scenes (${totalScenes} scenes total)
- Each narration segment: 55–80 spoken words, vivid storytelling voice
- Each image prompt: 20–35 words describing the scene visually for an AI image generator, consistent with ${themeLabel} style
- Parts 1 through ${numParts - 1}: end with a cliffhanger hook for the next part
- Part ${numParts}: resolve the story with a satisfying conclusion
- Keep character descriptions, names, and world details 100% consistent across all parts
- Escalate stakes across parts — each part must raise the tension

Respond ONLY with valid JSON — no markdown, no explanation, no code fences:
{
  "seriesTitle": "compelling title for the whole series",
  "characterSheet": "brief physical and personality description of main character(s), used for image consistency",
  "parts": [
    {
      "partNumber": 1,
      "title": "episode title",
      "scenes": [
        {
          "sceneNumber": 1,
          "narrationSegment": "spoken narration in ${langLabel}...",
          "imagePrompt": "visual scene description for AI image generator...",
          "mood": "one-word mood"
        }
      ]
    }
  ]
}`;
}

function extractJson(raw: string): string {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON object found in response");
  return raw.slice(firstBrace, lastBrace + 1);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idea, numParts = 2, durationTier = "short", language = "en", theme } = body as {
      idea: string;
      numParts?: number;
      durationTier?: string;
      language?: string;
      theme: string;
    };

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "Idea parameter is required" }, { status: 400 });
    }

    const scenesPerPart = SCENE_COUNTS[durationTier] || 9;
    const prompt = buildPrompt(idea, numParts, scenesPerPart, language, theme);

    const raw = await generateText({
      systemInstruction: "You are a professional video series writer.",
      userPrompt: prompt,
      temperature: 0.85,
    });

    try {
      const extracted = extractJson(raw);
      const story = JSON.parse(extracted);

      if (!story.seriesTitle || !Array.isArray(story.parts) || story.parts.length === 0) {
        return NextResponse.json({ error: "Incomplete series story generated." }, { status: 502 });
      }

      return NextResponse.json(story);
    } catch (parseErr) {
      console.error("Series story generation JSON parse failed. Raw was:", raw);
      return NextResponse.json({ error: "Series story generation returned invalid data format." }, { status: 502 });
    }
  } catch (err) {
    console.error("Series story generation failed:", err);
    return NextResponse.json({ error: "Series story generation failed. Please try again." }, { status: 502 });
  }
}
