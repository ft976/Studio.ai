import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/backend-ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, theme, seed } = body as {
      prompt: string;
      theme: string;
      seed: number;
    };

    if (!prompt || !theme) {
      return NextResponse.json({ error: "prompt and theme are required parameters" }, { status: 400 });
    }

    // Generate seed if not provided
    const imageSeed = typeof seed === "number" ? seed : Math.floor(Math.random() * 1000000);

    const result = await generateImage({
      prompt,
      theme,
      seed: imageSeed,
    });

    return NextResponse.json({
      imageBase64: result.base64,
      mimeType: "image/jpeg",
      seed: result.seed,
    });
  } catch (err) {
    console.error("Image generation endpoint error:", err);
    return NextResponse.json({ error: "Image generation failed. Please try again." }, { status: 502 });
  }
}
