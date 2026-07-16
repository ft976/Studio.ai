import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const RIVA_HOST = "grpc.nvcf.nvidia.com:443";
// Function ID for the hosted magpie-tts-multilingual model on NVIDIA's NVCF gRPC gateway.
const TTS_FUNCTION_ID = "877104f7-e885-42b9-8de8-f6e4c6303969";

interface SynthesizeSpeechResponse {
  audio: Buffer;
  meta?: {
    text?: string;
    processed_text?: string;
    predicted_durations?: number[];
  };
}

interface RivaSpeechSynthesisClient extends grpc.Client {
  Synthesize(
    request: Record<string, unknown>,
    metadata: grpc.Metadata,
    callback: (
      err: grpc.ServiceError | null,
      response?: SynthesizeSpeechResponse,
    ) => void,
  ): grpc.ClientUnaryCall;
}

let cachedClient: RivaSpeechSynthesisClient | null = null;

function getClient(): RivaSpeechSynthesisClient {
  if (cachedClient) return cachedClient;

  const protoRoot = path.join(process.cwd(), "lib", "proto");

  const packageDefinition = protoLoader.loadSync(
    path.join(protoRoot, "riva", "proto", "riva_tts.proto"),
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [protoRoot],
    },
  );

  const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
    nvidia: {
      riva: {
        tts: {
          RivaSpeechSynthesis: new (
            address: string,
            credentials: grpc.ChannelCredentials,
          ) => RivaSpeechSynthesisClient;
        };
      };
    };
  };

  cachedClient = new proto.nvidia.riva.tts.RivaSpeechSynthesis(
    RIVA_HOST,
    grpc.credentials.createSsl(),
  );
  return cachedClient;
}

function getApiKey(): string {
  const key = process.env["NVIDIA_API_KEY"];
  if (!key) {
    throw new Error(
      "NVIDIA_API_KEY environment variable is required but was not provided.",
    );
  }
  return key;
}

export interface SynthesizeResult {
  audio: Buffer;
  sampleRateHz: number;
}

export const MAGPIE_LANGUAGES: Record<
  string,
  { locale: string; voiceName: string }
> = {
  en: { locale: "en-US", voiceName: "Magpie-Multilingual.EN-US.Aria" },
  es: { locale: "es-US", voiceName: "Magpie-Multilingual.ES-US.Isabela" },
  de: { locale: "de-DE", voiceName: "Magpie-Multilingual.DE-DE.Leo" },
  fr: { locale: "fr-FR", voiceName: "Magpie-Multilingual.FR-FR.Pascal" },
  vi: { locale: "vi-VN", voiceName: "Magpie-Multilingual.VI-VN.Long" },
  it: { locale: "it-IT", voiceName: "Magpie-Multilingual.IT-IT.Aria" },
  zh: { locale: "zh-CN", voiceName: "Magpie-Multilingual.ZH-CN.Aria" },
  hi: { locale: "hi-IN", voiceName: "Magpie-Multilingual.HI-IN.Aria" },
  ja: { locale: "ja-JP", voiceName: "Magpie-Multilingual.JA-JP.Aria" },
};

/**
 * Synthesizes one short text segment (recommended max ~15s of audio) via the
 * hosted chatterbox-multilingual-tts model over NVIDIA's gRPC gateway.
 */
export function synthesizeSpeech(params: {
  text: string;
  languageCode: string;
  sampleRateHz?: number;
  voiceName?: string;
}): Promise<SynthesizeResult> {
  const sampleRateHz = params.sampleRateHz ?? 24000;
  const client = getClient();

  const metadata = new grpc.Metadata();
  metadata.set("authorization", `Bearer ${getApiKey()}`);
  metadata.set("function-id", TTS_FUNCTION_ID);

  return new Promise((resolve, reject) => {
    client.Synthesize(
      {
        text: params.text,
        language_code: params.languageCode,
        encoding: "LINEAR_PCM",
        sample_rate_hz: sampleRateHz,
        voice_name: params.voiceName ?? "",
      },
      metadata,
      (err, response) => {
        if (err) {
          console.error("Riva Synthesize RPC failed:", err);
          reject(err);
          return;
        }
        if (!response || !response.audio || response.audio.length === 0) {
          reject(new Error("Voice model returned no audio"));
          return;
        }
        resolve({
          audio: Buffer.from(response.audio),
          sampleRateHz,
        });
      },
    );
  });
}
