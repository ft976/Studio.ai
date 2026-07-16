import { NextRequest, NextResponse } from "next/server";
import { generateSpeech } from "@/lib/backend-ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, language = "en" } = body as {
      text: string;
      language?: string;
    };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "text parameter is required" }, { status: 400 });
    }

    const result = await generateSpeech({
      text,
      language,
    });

    return NextResponse.json({
      audioBase64: result.base64,
      mimeType: "audio/wav",
      durationSec: result.durationSec,
    });
  } catch (err) {
    console.error("Voice synthesis endpoint error:", err);
    return NextResponse.json({ error: "Voice synthesis failed. Please try again." }, { status: 502 });
  }
}
