import OpenAI from "openai";
import {
  CAMPAIGN_SYSTEM_PROMPT,
  buildCampaignInput
} from "./prompts.mjs";

const textModel =
  process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";

const campaignSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    campaignConcept: {
      type: "object",
      additionalProperties: false,

      properties: {
        name: {
          type: "string"
        },
        oneLiner: {
          type: "string"
        },
        rationale: {
          type: "string"
        },
        creativeDirection: {
          type: "string"
        }
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
          label: {
            type: "string"
          },
          headline: {
            type: "string"
          },
          body: {
            type: "string"
          },
          channelAngle: {
            type: "string"
          }
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
  if (!body || typeof body !== "object") {
    return "بيانات الطلب غير صحيحة.";
  }

  const requiredFields = [
    "brief",
    "audience",
    "product",
    "tone",
    "channels"
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return `الحقل مطلوب: ${field}`;
    }
  }

  if (
    !Array.isArray(body.channels) ||
    body.channels.length === 0
  ) {
    return "اختر قناة واحدة على الأقل.";
  }

  if (String(body.brief).length > 3000) {
    return "موجز الحملة طويل جدًا.";
  }

  if (String(body.audience).length > 1200) {
    return "الجمهور المستهدف طويل جدًا.";
  }

  if (String(body.product).length > 2000) {
    return "تفاصيل المنتج طويلة جدًا.";
  }

  if (String(body.tone).length > 160) {
    return "النغمة طويلة جدًا.";
  }

  return null;
}

async function createCampaign(openai, data) {
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
    throw new Error(
      "لم يُرجع OpenAI نتيجة نصية."
    );
  }

  try {
    return JSON.parse(response.output_text);
  } catch {
    throw new Error(
      "تعذر قراءة نتيجة OpenAI كبيانات JSON."
    );
  }
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json(405, {
      error: "Method not allowed"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(500, {
      error:
        "OPENAI_API_KEY غير موجود في إعدادات Netlify."
    });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(400, {
      error: "تعذر قراءة بيانات الطلب."
    });
  }

  const validationError =
    validateCampaign(body);

  if (validationError) {
    return json(400, {
      error: validationError
    });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const campaign =
      await createCampaign(openai, body);

    return json(200, {
      ...campaign,

      // الصور سنضيفها بعد نجاح توليد الحملة النصية.
      images: []
    });

  } catch (error) {
    console.error(
      "Campaign generation error:",
      error
    );

    const status =
      Number.isInteger(error?.status)
        ? error.status
        : 500;

    let message =
      error?.message ||
      "حدث خطأ أثناء إنشاء الحملة.";

    if (status === 401) {
      message =
        "مفتاح OpenAI غير صالح أو غير مصرح به.";
    }

    if (status === 403) {
      message =
        "ليس لديك صلاحية لاستخدام نموذج OpenAI المطلوب.";
    }

    if (status === 404) {
      message =
        "نموذج OpenAI المحدد غير موجود أو غير متاح.";
    }

    if (status === 429) {
      message =
        "تم الوصول إلى حد استخدام OpenAI. حاول لاحقًا.";
    }

    return json(status, {
      error: message,
      status
    });
  }
}
