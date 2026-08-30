const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";

// ---------- Session guard ----------
const zfClientId = localStorage.getItem("zf_clientId");
if (!zfClientId) {
  window.location.href = "login.html";
}

let pricingConfig = null;

function callBackend(payload) {
  return fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function showStatus(message, type) {
  const box = document.getElementById("statusBox");
  box.textContent = message;
  box.className = "status-box show status-" + type;
}

function clearStatus() {
  const box = document.getElementById("statusBox");
  box.className = "status-box";
}

// ---------- Load pricing config, then wire the form ----------
async function loadConfigAndInit() {
  try {
    const result = await callBackend({ action: "getPricingConfig" });
    if (!result.success) {
      showStatus("Could not load pricing right now. Please refresh.", "error");
      return;
    }
    pricingConfig = result;

    // If arriving from a Services & Pricing card, pre-select that level —
    // still fully editable, just a head start.
    const requestedLevel = new URLSearchParams(window.location.search).get("level");
    if (requestedLevel && pricingConfig.byLevel[requestedLevel]) {
      document.getElementById("ord-level").value = requestedLevel;
    }

    onLevelChange();
    recalculate();
    document.getElementById("orderForm").style.display = "";
    document.getElementById("formLoading").style.display = "none";
  } catch (err) {
    showStatus("Could not reach the server. Please refresh.", "error");
    console.error(err);
  }
}

// ---------- When academic level changes, reset revisits/deadline defaults + bounds ----------
function onLevelChange() {
  const level = document.getElementById("ord-level").value;
  const levelConfig = pricingConfig.byLevel[level];
  if (!levelConfig) return;

  const revisitsInput = document.getElementById("ord-revisits");
  const deadlineInput = document.getElementById("ord-deadline");

  revisitsInput.min = levelConfig.minRevisits;
  revisitsInput.max = levelConfig.minRevisits + pricingConfig.maxExtraRevisits;
  revisitsInput.value = levelConfig.minRevisits;

  deadlineInput.min = levelConfig.deadlineFloor;
  deadlineInput.value = levelConfig.standardTimeline;

  document.getElementById("revisitsHint").textContent =
    "A revisit is when we revise your work after you upload your supervisor's comment. Minimum " + levelConfig.minRevisits + " revisits are included for " + level + ". You can add up to " + pricingConfig.maxExtraRevisits + " more now, each costing " + formatNaira(pricingConfig.revisitFee) + ". You can also top up further revisits later while the order is ongoing.";
  document.getElementById("deadlineHint").textContent =
    "Standard delivery for " + level + " is " + levelConfig.standardTimeline + " days. Asking for it sooner adds " + pricingConfig.urgencyPercent + "% of the base price for every day earlier than standard. It cannot be shorter than " + levelConfig.deadlineFloor + " days, even at extra cost.";
}

// ---------- Live price calculation, mirrors handleCreateOrder's formula exactly ----------
function recalculate() {
  if (!pricingConfig) return;

  const level = document.getElementById("ord-level").value;
  const levelConfig = pricingConfig.byLevel[level];
  if (!levelConfig) return;

  const revisitsPurchased = Number(document.getElementById("ord-revisits").value) || levelConfig.minRevisits;
  const requestedDeadlineDays = Number(document.getElementById("ord-deadline").value) || levelConfig.standardTimeline;

  const extraRevisits = Math.max(0, revisitsPurchased - levelConfig.minRevisits);
  const extraRevisitsCost = extraRevisits * pricingConfig.revisitFee;

  const daysShorter = Math.max(0, levelConfig.standardTimeline - requestedDeadlineDays);
  const urgencyCost = levelConfig.basePrice * (pricingConfig.urgencyPercent / 100) * daysShorter;

  const totalPrice = levelConfig.basePrice + extraRevisitsCost + urgencyCost;

  document.getElementById("sumBase").textContent = formatNaira(levelConfig.basePrice);
  document.getElementById("sumRevisits").textContent = formatNaira(extraRevisitsCost);
  document.getElementById("sumUrgency").textContent = formatNaira(urgencyCost);
  document.getElementById("sumTotal").textContent = formatNaira(totalPrice);

  const isScience = document.getElementById("ord-science").checked;
  document.getElementById("scienceNote").style.display = isScience ? "block" : "none";
}

// ---------- Submit ----------
async function submitOrder(e) {
  e.preventDefault();
  clearStatus();

  const level = document.getElementById("ord-level").value;
  const fieldProgramme = document.getElementById("ord-field").value.trim();
  const topic = document.getElementById("ord-topic").value.trim();
  const institution = document.getElementById("ord-institution").value.trim();
  const referencingStyle = document.getElementById("ord-referencing").value;
  const isScience = document.getElementById("ord-science").checked;
  const revisitsPurchased = Number(document.getElementById("ord-revisits").value);
  const requestedDeadlineDays = Number(document.getElementById("ord-deadline").value);
  const attestationAccepted = document.getElementById("ord-attest").checked;

  if (!level || !fieldProgramme || !topic || !referencingStyle) {
    showStatus("Please fill in every required field.", "error");
    return;
  }
  if (!attestationAccepted) {
    showStatus("You must accept the attestation to place an order.", "error");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Placing your request...";

  try {
    const result = await callBackend({
      action: "createOrder",
      clientId: zfClientId,
      academicLevel: level,
      fieldProgramme: fieldProgramme,
      topic: topic,
      institution: institution,
      referencingStyle: referencingStyle,
      isScience: isScience,
      revisitsPurchased: revisitsPurchased,
      requestedDeadlineDays: requestedDeadlineDays,
      attestationAccepted: attestationAccepted
    });

    if (!result.success) {
      showStatus(result.error, "error");
      btn.disabled = false;
      btn.textContent = "Place Request";
      return;
    }

    showStatus("Request placed. Total: " + formatNaira(result.totalPrice) + ". Taking you to your dashboard to pay...", "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1800);
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "Place Request";
  }
}

document.getElementById("ord-level").addEventListener("change", () => { onLevelChange(); recalculate(); });
document.getElementById("ord-revisits").addEventListener("input", recalculate);
document.getElementById("ord-deadline").addEventListener("input", recalculate);
document.getElementById("ord-science").addEventListener("change", recalculate);
document.getElementById("orderForm").addEventListener("submit", submitOrder);

document.addEventListener("DOMContentLoaded", loadConfigAndInit);
