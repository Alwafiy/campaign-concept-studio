import OpenAI from "openai";
import { CAMPAIGN_SYSTEM_PROMPT, buildCampaignInput } from "./prompts.mjs";

const textModel = process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function validateCampaign(body) {
  const required = ["brief", "audience", "product", "tone", "channels"];

  for (const field of required) {
    if (!body?.[field]) {
      return `Missing field: ${field}`;
    }
  }

  if (!Array.isArray(body.channels) || body.channels.length === 0) {
    return "Choose at least one channel.";
  }

  return null;
}

const campaignSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    campaignConcept: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        oneLiner: { type: "string" },
        rationale: { type: "string" },
        creativeDirection: { type: "string" }
      },
      required: [
        "name",
        "oneLiner",
        "rationale",
        "creativeDirection"
      ]
    },

    variants: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
          channelAngle: { type: "string" }
        },
        required: [
          "label",
          "headline",
          "body",
          "channelAngle"
        ]
      }
    },

    launchChecklist: {
      type: "array",
      minItems: 7,
      maxItems: 10,
      items: {
        type: "string"
      }
    },

    imagePrompts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "string"
      }
    }
  },

  required: [
    "campaignConcept",
    "variants",
    "launchChecklist",
    "imagePrompts"
  ]
};

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

  if (!response.output_text) {
    throw new Error("لم يُرجع النموذج خطة حملة.");
  }

  return JSON.parse(response.output_text);
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, {
      error: "Method not allowed"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(500, {
      error: "OPENAI_API_KEY غير موجود في Netlify."
    });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(400, {
      error: "بيانات الطلب غير صالحة."
    });
  }

  const validationError = validateCampaign(body);

  if (validationError) {
    return json(400, {
      error: validationError
    });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const campaign = await generateCampaign(openai, body);

    return json(200, {
      ...campaign,
      images: []
    });

  } catch (error) {
    console.error("Campaign error:", error);

    const status =
      Number.isInteger(error?.status) ? error.status : 500;

    return json(status, {
      error:
        error?.message ||
        "حدث خطأ أثناء إنشاء الحملة."
    });
  }
};
