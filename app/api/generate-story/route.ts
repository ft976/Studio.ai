import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/backend-ai";

const IMAGE_COUNT_BY_TIER: Record<"short" | "long", number> = {
  short: 7,
  long: 9,
};

const WORDS_PER_SEC = 2.35;
const CJK_LANGUAGES = new Set(["zh", "ja", "ko"]);

function isCjk(language: string): boolean {
  return CJK_LANGUAGES.has(language);
}

function targetUnitCount(durationTier: "short" | "long", language: string): number {
  const midpointSec = durationTier === "short" ? 45 : 65;
  if (isCjk(language)) {
    return Math.round(midpointSec * 3.5);
  }
  return Math.round(midpointSec * WORDS_PER_SEC);
}

function countUnits(text: string, language: string): number {
  if (isCjk(language)) {
    return Array.from(text.replace(/\s/g, "")).length;
  }
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildSystemPrompt(imageCount: number, unitTarget: number, language: string): string {
  const unitLabel = isCjk(language) ? "characters" : "words";
  return `You are a short-form video story writer. Write a complete, self-contained short story/narration for a vertical short video, in the language with code "${language}".

Respond with ONLY a single JSON object (no markdown fences, no commentary) with this exact shape:
{
  "title": "short catchy title, <= 60 characters",
  "characterSheet": "a fixed 2-4 sentence visual description of the main character(s)/setting style, written so it can be prepended to every scene's image prompt for visual consistency",
  "scenes": [
    { "narrationSegment": "1-3 sentences of narration for this scene, in the target language", "imagePrompt": "a vivid, concrete visual description of this scene for an image generator, in English, describing action/setting/mood (do not repeat the character sheet, it will be prepended automatically)" }
  ]
}

Hard requirements:
- Produce EXACTLY ${imageCount} entries in "scenes".
- The concatenation of all "narrationSegment" fields must total approximately ${unitTarget} ${unitLabel} (within 15%). This is critical for timing -- do not undershoot or overshoot significantly.
- The story must have a clear beginning, middle, and satisfying end across the ${imageCount} scenes.
- "imagePrompt" must be concrete and visual, never abstract.
- narrationSegment must be natural spoken narration in the target language, not stage directions.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idea, language = "en", durationTier = "short", theme } = body as {
      idea: string;
      language?: string;
      durationTier?: "short" | "long";
      theme: string;
    };

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "Idea parameter is required" }, { status: 400 });
    }

    const imageCount = IMAGE_COUNT_BY_TIER[durationTier] || 7;
    const unitTarget = targetUnitCount(durationTier, language);

    const systemPrompt = buildSystemPrompt(imageCount, unitTarget, language);
    const userPrompt = `Idea: ${idea}\nVisual theme (for tone/mood only, do not name it literally in the story): ${theme}`;

    const raw = await generateText({
      systemInstruction: systemPrompt,
      userPrompt,
      temperature: 0.85,
    });

    let jsonText = raw.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    }

    let data: {
      title: string;
      characterSheet: string;
      scenes: Array<{ narrationSegment: string; imagePrompt: string }>;
    };

    try {
      data = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("Failed to parse story JSON. Raw was:", raw);
      return NextResponse.json({ error: "Failed to generate structured story script format." }, { status: 502 });
    }

    if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
      return NextResponse.json({ error: "Story script returned no scenes." }, { status: 502 });
    }

    // Slice to exact required scenes count
    const scenes = data.scenes.slice(0, imageCount);
    const storyText = scenes.map((s) => s.narrationSegment).join(" ");
    const wordCount = countUnits(storyText, language);

    return NextResponse.json({
      title: data.title || "Untitled Short",
      story: storyText,
      characterSheet: data.characterSheet || "",
      scenes: scenes.map((s, index) => ({
        index,
        narrationSegment: s.narrationSegment,
        imagePrompt: s.imagePrompt,
      })),
      targetWordCount: unitTarget,
      wordCount,
      imageCount: scenes.length,
    });
  } catch (err) {
    console.error("Story generation endpoint error:", err);
    return NextResponse.json({ error: "Story generation failed. Please try again." }, { status: 502 });
  }
}
