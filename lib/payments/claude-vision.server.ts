import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { serverEnv } from "@/lib/env/env.server";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

let client: Anthropic | null = null;

export function claudeVisionConfigured(): boolean {
  return Boolean(serverEnv.anthropicApiKey.trim());
}

/**
 * Respaldo de OpenAI para leer comprobantes: envía la imagen (o PDF) a Claude y
 * devuelve el texto JSON de la respuesta, o null si no hay clave o falla.
 */
export async function claudeVisionJson(input: {
  prompt: string;
  buffer: Buffer;
  mimeType: string;
  timeoutMs?: number;
  tag: string;
  /** Por defecto ANTHROPIC_VISION_MODEL; los comprobantes usan VOUCHER_CLAUDE_MODEL. */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}): Promise<string | null> {
  const apiKey = serverEnv.anthropicApiKey.trim();
  if (!apiKey) return null;

  const mime = input.mimeType.toLowerCase();
  const data = input.buffer.toString("base64");
  let media: ContentBlockParam;
  if (mime === "application/pdf") {
    media = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else if ((IMAGE_TYPES as readonly string[]).includes(mime)) {
    media = { type: "image", source: { type: "base64", media_type: mime as ImageType, data } };
  } else {
    return null;
  }

  client ??= new Anthropic({ apiKey, maxRetries: 1 });
  try {
    const response = await client.messages.create(
      {
        model: input.model ?? serverEnv.anthropicVisionModel,
        max_tokens: 16000,
        output_config: { effort: input.effort ?? "low" },
        messages: [
          {
            role: "user",
            content: [
              media,
              { type: "text", text: `${input.prompt}\n\nResponde únicamente con el objeto JSON, sin texto adicional ni bloques de código.` },
            ],
          },
        ],
      },
      { timeout: input.timeoutMs ?? 45_000 },
    );
    if (response.stop_reason !== "end_turn") {
      console.error(`[${input.tag}] claude stop_reason`, response.stop_reason);
      return null;
    }
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return start >= 0 && end > start ? text.slice(start, end + 1) : null;
  } catch (error) {
    console.error(`[${input.tag}] claude failed`, error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return null;
  }
}
