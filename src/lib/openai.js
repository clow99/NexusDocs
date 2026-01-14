import OpenAI from "openai";

let openaiClient = null;

function ensureClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export function getOpenAIClient() {
  return ensureClient();
}

export function getOpenAIModels() {
  const readModel = process.env.OPENAI_READ_MODEL || "gpt-4o";
  const writeModel = process.env.OPENAI_WRITE_MODEL || "gpt-5.1";
  return { readModel, writeModel };
}

export function getOpenAIModelLabel() {
  const { readModel, writeModel } = getOpenAIModels();
  return `OpenAI (read: ${readModel}, write: ${writeModel})`;
}
