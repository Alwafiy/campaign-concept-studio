const $ = (selector) => document.querySelector(selector);

const form = $("#campaignForm");
const generateButton = $("#generateButton");
const emptyState = $("#emptyState");
const loadingState = $("#loadingState");
const errorState = $("#errorState");
const errorText = $("#errorText");
const results = $("#results");
const retryButton = $("#retryButton");

let lastPayload = null;
let lastCampaign = null;

function setState(state) {
  [emptyState, loadingState, errorState, results].forEach((el) => {
    if (el) el.classList.add("hidden");
  });

  const target = $(state);
  if (target) target.classList.remove("hidden");
}

function getPayload() {
  return {
    brief: $("#brief").value.trim(),
    audience: $("#audience").value.trim(),
    product: $("#product").value.trim(),
    tone: $("#tone").value.trim(),
    channels: [
      ...document.querySelectorAll('input[name="channel"]:checked')
    ].map((x) => x.value)
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderCampaign(data) {
  lastCampaign = data;

  $("#conceptName").textContent =
    data.campaignConcept?.name || "";

  $("#conceptOneLiner").textContent =
    data.campaignConcept?.oneLiner || "";

  $("#conceptRationale").textContent =
    data.campaignConcept?.rationale || "";

  $("#creativeDirection").textContent =
    data.campaignConcept?.creativeDirection || "";

  $("#variants").innerHTML = (data.variants || []).map((v) => `
    <article class="variant-card">
      <div class="variant-label">${escapeHtml(v.label)}</div>
      <h4>${escapeHtml(v.headline)}</h4>
      <p>${escapeHtml(v.body)}</p>
      <p class="channel-angle">
        ${escapeHtml(v.channelAngle)}
      </p>
    </article>
  `).join("");

  $("#checklist").innerHTML =
    (data.launchChecklist || []).map((item, i) => `
      <label class="check">
        <input type="checkbox">
        <span>${i + 1}. ${escapeHtml(item)}</span>
      </label>
    `).join("");

  $("#images").innerHTML =
    (data.images || []).map((src, i) => `
      <article class="image-card">
        <img
          src="${escapeHtml(src)}"
          alt="Generated campaign visual ${i + 1}"
          loading="lazy"
        >
        <p>${escapeHtml(data.imagePrompts?.[i] || "")}</p>
      </article>
    `).join("");

  setState("#results");
}

async function runGeneration() {
  if (!lastPayload) return;

  generateButton.disabled = true;
  setState("#loadingState");

  try {
    const response = await fetch(
      "/.netlify/functions/campaign",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(lastPayload)
      }
    );

    const contentType =
      response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      throw new Error(
        `الخادم أعاد استجابة غير متوقعة (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || "حدث خطأ أثناء إنشاء الحملة."
      );
    }

    renderCampaign(data);

  } catch (error) {
    console.error(error);

    errorText.textContent =
      error.message ||
      "حدث خطأ أثناء الاتصال بالخادم.";

    setState("#errorState");

  } finally {
    generateButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  lastPayload = getPayload();

  if (!lastPayload.brief) {
    errorText.textContent =
      "يرجى كتابة موجز الحملة.";

    setState("#errorState");
    return;
  }

  if (!lastPayload.channels.length) {
    errorText.textContent =
      "اختر قناة واحدة على الأقل.";

    setState("#errorState");
    return;
  }

  runGeneration();
});

if (retryButton) {
  retryButton.addEventListener(
    "click",
    runGeneration
  );
}

const copyConcept = $("#copyConcept");

if (copyConcept) {
  copyConcept.addEventListener(
    "click",
    async () => {
      if (!lastCampaign) return;

      const text = [
        lastCampaign.campaignConcept?.name || "",
        lastCampaign.campaignConcept?.oneLiner || "",
        lastCampaign.campaignConcept?.rationale || ""
      ].join("\n\n");

      try {
        await navigator.clipboard.writeText(text);

        copyConcept.textContent = "تم النسخ";

        setTimeout(() => {
          copyConcept.textContent = "نسخ";
        }, 1200);

      } catch {
        errorText.textContent =
          "تعذر نسخ النص.";
      }
    }
  );
}
