import OpenAI from "openai";
import { CAMPAIGN_SYSTEM_PROMPT, buildCampaignInput } from "./prompts.mjs";

const textModel = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

const campaignSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    campaignConcept: {
      type: "object", additionalProperties: false,
      properties: {
        name: { type: "string" },
        oneLiner: { type: "string" },
        rationale: { type: "string" },
        creativeDirection: { type: "string" }
      },
      required: ["name", "oneLiner", "rationale", "creativeDirection"]
    },
    variants: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          label: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
          channelAngle: { type: "string" }
        },
        required: ["label", "headline", "body", "channelAngle"]
      }
    },
    launchChecklist: { type: "array", minItems: 7, maxItems: 10, items: { type: "string" } },
    imagePrompts: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } }
  },
  required: ["campaignConcept", "variants", "launchChecklist", "imagePrompts"]
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

function validateCampaign(body) {
  const required = ["brief", "audience", "product", "tone", "channels"];
  for (const field of required) if (!body?.[field]) return `Missing field: ${field}`;
  if (!Array.isArray(body.channels) || body.channels.length === 0) return "Choose at least one channel.";
  if (String(body.brief).length > 3000) return "Brief is too long (max 3000 characters).";
  if (String(body.audience).length > 1200) return "Audience is too long (max 1200 characters).";
  if (String(body.product).length > 2000) return "Product details are too long (max 2000 characters).";
  if (String(body.tone).length > 160) return "Tone is too long (max 160 characters).";
  return null;
}

async function generateCampaign(openai, data) {
  const response = await openai.responses.create({
    model: textModel,
    instructions: CAMPAIGN_SYSTEM_PROMPT,
    input: buildCampaignInput(data),
    text: {
      format: {
        type: "json_schema",
        name: "campaign_plan",
        strict: true,
        schema: campaignSchema
      }
    }
  });
  if (!response.output_text) throw new Error("The model returned no campaign plan.");
  return JSON.parse(response.output_text);
}

async function generateCampaignImage(openai, prompt) {
  const result = await openai.images.generate({
    model: imageModel,
    prompt,
    size: "1536x1024",
    quality: "high"
  });
  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image data.");
  return `data:image/png;base64,${b64}`;
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY is not configured on the server." });

  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Invalid JSON request." }); }

  const error = validateCampaign(body);
  if (error) return json(400, { error });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const campaign = await generateCampaign(openai, body);
    const images = await Promise.all(campaign.imagePrompts.map((prompt) => generateCampaignImage(openai, prompt)));
    return json(200, { ...campaign, images });
  } catch (err) {
    console.error(err);
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return json(status, {
      error: status === 429 ? "OpenAI rate limit reached. Please wait a moment and try again." : "Campaign generation failed. Check your API key and deployment logs."
    });
  }
};
