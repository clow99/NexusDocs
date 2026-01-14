/**
 * AI Status API Route
 * Returns configuration status of AI service
 * IMPORTANT: The OPENAI_API_KEY is accessed only here on the server
 * and is NEVER exposed to the client
 */

import { NextResponse } from "next/server";
import { getOpenAIModelLabel, getOpenAIModels } from "@/lib/openai";

export async function GET() {
  // Check if OpenAI is configured (key exists in env)
  // We check for the key but NEVER send it to the client
  const isConfigured = !!process.env.OPENAI_API_KEY;
  const models = isConfigured ? getOpenAIModels() : null;

  return NextResponse.json({
    configured: isConfigured,
    defaultModelLabel: isConfigured ? getOpenAIModelLabel() : null,
    models: models
      ? {
          read: models.readModel,
          write: models.writeModel,
        }
      : null,
    limits: isConfigured
      ? {
          requestsPerMinute: 60,
          tokensPerMinute: 90000,
        }
      : null,
  });
}
