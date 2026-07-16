import { NextResponse } from "next/server";
import { generateText } from "@/lib/backend-ai";

const IDEA_SYSTEM_PROMPT = `You are a creative short-form video story idea generator. 
Generate ONE compelling, imaginative idea for a vertical short video (40-70 seconds).
The idea should be a single vivid sentence or two that sparks a complete story: 
a character, a situation, and a hint of conflict or wonder.

Respond with ONLY the raw idea text in a JSON object with a single "idea" key. Do not include markdown code fences or other fields.
Example response:
{
  "idea": "An explorer in an ancient desert finds a compass that points only to things the user deeply regrets losing."
}`;

const IDEA_SEEDS = [
  "Give me a unique, unexpected story idea for a short video.",
  "Suggest a dramatic or emotional short story premise.",
  "Create a mysterious or fantastical short video idea.",
  "Give me an action-packed or thriller short story concept.",
  "Suggest a heartwarming or bittersweet short video story.",
];

export async function POST() {
  const seed = IDEA_SEEDS[Math.floor(Math.random() * IDEA_SEEDS.length)];

  try {
    const raw = await generateText({
      systemInstruction: IDEA_SYSTEM_PROMPT,
      userPrompt: seed,
      temperature: 1.0,
    });

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    }

    try {
      const parsed = JSON.parse(cleaned) as { idea: string };
      if (parsed.idea) {
        return NextResponse.json({ idea: parsed.idea });
      }
    } catch {
      // If parsing fails, fall back to treating the raw response as the idea
      return NextResponse.json({ idea: cleaned.replace(/^["']|["']$/g, "") });
    }

    return NextResponse.json({ idea: cleaned });
  } catch (err) {
    console.error("Idea generation failed:", err);
    return NextResponse.json({ error: "Could not generate an idea. Please try again." }, { status: 502 });
  }
}
