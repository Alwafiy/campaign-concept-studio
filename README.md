# Campaign Concept Studio

A production-ready campaign concept studio for marketing teams. Enter a brief, target audience, product details, tone, and desired channels to generate a campaign concept, three copy variants, a launch checklist, image prompts, and generated campaign visuals.

## Stack

- Frontend: semantic HTML, CSS, vanilla JavaScript in `public/`
- Backend: Netlify Function in `netlify/functions/campaign.mjs`
- Text: OpenAI Responses API
- Images: OpenAI Images API
- Deployment: Netlify + GitHub

## Client/server boundary

The browser never imports the OpenAI SDK and never receives `OPENAI_API_KEY`. The browser sends one request to `/api/campaign`. The Netlify Function validates the request, calls OpenAI, generates the campaign assets, and returns the result. Keep the API key only in Netlify environment variables.

## Deploy from a phone

1. Connect this GitHub repository to Netlify with **Add new project → Import an existing project**.
2. Netlify will read `netlify.toml`; publish directory is `public` and Functions directory is `netlify/functions`.
3. In Netlify, open **Project configuration → Environment variables**.
4. Add `OPENAI_API_KEY` as a secret. Optionally add `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL`.
5. Deploy. If you change environment variables later, trigger a new deploy.

Never commit `.env` or an API key. `.gitignore` already excludes `.env`.

## Local development

The deployed architecture is Netlify Functions. For local testing, use the Netlify CLI so the same function routing is available:

```bash
npm install
npx netlify dev
```

Then open the local URL shown by Netlify CLI.

## API flow

1. `POST /api/campaign` validates the required fields.
2. `client.responses.create(...)` generates strict structured campaign JSON.
3. The returned `imagePrompts` are sent to `client.images.generate(...)`.
4. The Function returns the campaign JSON and generated image data URLs.

This project intentionally does not use legacy Completions or Chat Completions code.

## Model and prompt tuning

- Text model: `OPENAI_TEXT_MODEL` in Netlify environment variables; default `gpt-5.6-luna`.
- Image model: `OPENAI_IMAGE_MODEL`; default `gpt-image-2`.
- Campaign strategy prompt: `netlify/functions/prompts.mjs`.
- Structured output schema and image settings: `netlify/functions/campaign.mjs`.
- UI polish: `public/index.html` and `public/styles.css`.

## Validation plan

### Functional

- Submit a complete brief and verify one concept, exactly 3 copy variants, 7–10 checklist items, exactly 3 image prompts, and 3 images.
- Submit without a channel and confirm validation rejects it.
- Test multiple channel combinations.
- Test retry after an API failure.
- Test copy-to-clipboard.

### Security

- Confirm `OPENAI_API_KEY` is absent from the browser bundle.
- Confirm `.env` is ignored.
- Test oversized fields and verify validation rejects them.
- Before public high-traffic use, add authentication, rate limiting, logging, and usage controls.

### Quality

Run representative briefs across different products, audiences, tones, and channels. Review strategic specificity, copy diversity, channel fit, factual-claim discipline, and visual relevance.

## OpenAI documentation

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/models/gpt-image-2
