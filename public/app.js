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
  [emptyState, loadingState, errorState, results].forEach((el) => el.classList.add("hidden"));
  $(state).classList.remove("hidden");
}

function getPayload() {
  return {
    brief: $("#brief").value.trim(),
    audience: $("#audience").value.trim(),
    product: $("#product").value.trim(),
    tone: $("#tone").value.trim(),
    channels: [...document.querySelectorAll('input[name="channel"]:checked')].map((x) => x.value)
  };
}

function renderCampaign(data) {
  lastCampaign = data;
  $("#conceptName").textContent = data.campaignConcept.name;
  $("#conceptOneLiner").textContent = data.campaignConcept.oneLiner;
  $("#conceptRationale").textContent = data.campaignConcept.rationale;
  $("#creativeDirection").textContent = data.campaignConcept.creativeDirection;

  $("#variants").innerHTML = data.variants.map((v) => `
    <article class="variant-card">
      <div class="variant-label">${escapeHtml(v.label)}</div>
      <h4>${escapeHtml(v.headline)}</h4>
      <p>${escapeHtml(v.body)}</p>
      <p class="channel-angle">${escapeHtml(v.channelAngle)}</p>
    </article>
  `).join("");

  $("#checklist").innerHTML = data.launchChecklist.map((item, i) => `
    <label class="check"><input type="checkbox"><span>${i + 1}. ${escapeHtml(item)}</span></label>
  `).join("");

  $("#images").innerHTML = data.images.map((src, i) => `
    <article class="image-card">
      <img src="${src}" alt="Generated campaign visual ${i + 1}" loading="lazy">
      <p>${escapeHtml(data.imagePrompts[i])}</p>
    </article>
  `).join("");

  setState("#results");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

async function runGeneration() {
  if (!lastPayload) return;
  generateButton.disabled = true;
  setState("#loadingState");
  try {
    const response = await fetch("/api/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastPayload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    renderCampaign(data);
  } catch (error) {
    errorText.textContent = error.message;
    setState("#errorState");
  } finally {
    generateButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  lastPayload = getPayload();
  if (!lastPayload.channels.length) {
    errorText.textContent = "Choose at least one channel.";
    setState("#errorState");
    return;
  }
  runGeneration();
});

retryButton.addEventListener("click", runGeneration);

$("#copyConcept").addEventListener("click", async () => {
  if (!lastCampaign) return;
  const text = [
    lastCampaign.campaignConcept.name,
    lastCampaign.campaignConcept.oneLiner,
    lastCampaign.campaignConcept.rationale
  ].join("\n\n");
  await navigator.clipboard.writeText(text);
  $("#copyConcept").textContent = "Copied";
  setTimeout(() => $("#copyConcept").textContent = "Copy", 1200);
});
