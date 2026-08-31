const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";

// ---------- Session guard ----------
const zfClientId = localStorage.getItem("zf_clientId");
if (!zfClientId) {
  window.location.href = "login.html";
}

let pricingConfig = null;
let currentEmail = localStorage.getItem("zf_email") || "";
const PAYSTACK_PUBLIC_KEY = "pk_test_cddc8c3744db3437e87cf07597f4a7cc0411cb91";

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

    const requestedType = new URLSearchParams(window.location.search).get("type");
    if (requestedType === "check") {
      document.getElementById("toggleCheckBtn").click();
    }

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

// ---------- Toggle between Research Order and Plagiarism/AI Check ----------
document.getElementById("toggleResearchBtn").addEventListener("click", () => {
  document.getElementById("toggleResearchBtn").classList.add("active");
  document.getElementById("toggleCheckBtn").classList.remove("active");
  document.getElementById("orderForm").style.display = "";
  document.getElementById("checkForm").style.display = "none";
  clearStatus();
});

document.getElementById("toggleCheckBtn").addEventListener("click", () => {
  document.getElementById("toggleCheckBtn").classList.add("active");
  document.getElementById("toggleResearchBtn").classList.remove("active");
  document.getElementById("orderForm").style.display = "none";
  document.getElementById("checkForm").style.display = "";
  clearStatus();
  recalculateCheck();
});

// ---------- Plagiarism/AI check: exclusions visibility + live price ----------
function recalculateCheck() {
  if (!pricingConfig || !pricingConfig.checkPricing) return;

  const wantsPlagiarism = document.getElementById("chk-plagiarism").checked;
  const wantsAi = document.getElementById("chk-ai").checked;
  document.getElementById("exclusionsField").style.display = wantsPlagiarism ? "" : "none";

  let total = 0;
  if (wantsPlagiarism && wantsAi) {
    total = pricingConfig.checkPricing.Both;
  } else if (wantsPlagiarism) {
    total = pricingConfig.checkPricing.Plagiarism;
  } else if (wantsAi) {
    total = pricingConfig.checkPricing.AI;
  }
  document.getElementById("chkTotal").textContent = formatNaira(total);

  const hours = pricingConfig.checkTurnaroundHours || 2;
  document.getElementById("chkTurnaroundNote").textContent = "Usually ready within " + hours + " hours.";
}

["chk-plagiarism", "chk-ai"].forEach((id) => {
  document.getElementById(id).addEventListener("change", recalculateCheck);
});

// ---------- Submit check order: create -> pay -> unlock upload ----------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitCheckOrder(e) {
  e.preventDefault();
  clearStatus();

  const wantsPlagiarism = document.getElementById("chk-plagiarism").checked;
  const wantsAi = document.getElementById("chk-ai").checked;
  const file = document.getElementById("chk-file").files[0];

  if (!wantsPlagiarism && !wantsAi) {
    showStatus("Please select at least one check.", "error");
    return;
  }
  if (!file) {
    showStatus("Please choose a document to upload.", "error");
    return;
  }

  let checkTypes = "Both";
  if (wantsPlagiarism && !wantsAi) checkTypes = "Plagiarism";
  if (wantsAi && !wantsPlagiarism) checkTypes = "AI";

  const exclusions = [];
  if (wantsPlagiarism) {
    if (document.getElementById("excl-bibliography").checked) exclusions.push("Bibliography");
    if (document.getElementById("excl-quotes").checked) exclusions.push("Quotes");
    if (document.getElementById("excl-prelim").checked) exclusions.push("Preliminary Pages");
  }

  const btn = document.getElementById("chkSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Setting up your order...";

  try {
    const createResult = await callBackend({
      action: "createCheckOrder",
      clientId: zfClientId,
      checkTypes: checkTypes,
      exclusions: exclusions.join(", ")
    });

    if (!createResult.success) {
      showStatus(createResult.error, "error");
      btn.disabled = false;
      btn.textContent = "Continue to Payment";
      return;
    }

    const payResult = await callBackend({
      action: "initializeCheckPayment",
      checkId: createResult.checkId,
      clientId: zfClientId,
      email: currentEmail
    });

    if (!payResult.success) {
      showStatus("Order created, but starting payment failed: " + payResult.error, "error");
      btn.disabled = false;
      btn.textContent = "Continue to Payment";
      return;
    }

    btn.textContent = "Opening payment...";

    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: payResult.email,
      amount: Math.round(payResult.amount * 100),
      ref: payResult.reference,
      callback: function (response) {
        finishCheckPaymentAndUpload(response.reference, createResult.checkId, file, btn);
      },
      onClose: function () {
        showStatus("Payment window closed. Your order is saved as unpaid, you can pay it from your dashboard.", "info");
        btn.disabled = false;
        btn.textContent = "Continue to Payment";
      }
    });
    handler.openIframe();
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "Continue to Payment";
  }
}

async function finishCheckPaymentAndUpload(reference, checkId, file, btn) {
  showStatus("Confirming your payment...", "info");
  btn.textContent = "Confirming payment...";

  try {
    const verifyResult = await callBackend({ action: "verifyPayment", reference: reference });
    if (!verifyResult.success) {
      showStatus("Payment made, but we couldn't confirm it yet. Please check your dashboard shortly.", "error");
      window.location.href = "dashboard.html";
      return;
    }

    showStatus("Payment confirmed. Uploading your document...", "info");
    btn.textContent = "Uploading document...";

    const base64Data = await fileToBase64(file);
    const uploadResult = await callBackend({
      action: "uploadFile",
      fileName: file.name,
      mimeType: file.type,
      base64Data: base64Data,
      folderName: "ZeroFluke Check Documents"
    });

    if (!uploadResult.success) {
      showStatus("Payment confirmed, but the document upload failed. You can upload it from your dashboard.", "error");
      window.location.href = "dashboard.html";
      return;
    }

    const finalResult = await callBackend({
      action: "uploadCheckDocument",
      checkId: checkId,
      clientId: zfClientId,
      documentLink: uploadResult.fileUrl
    });

    if (finalResult.success) {
      showStatus("Document uploaded. Your check is now in progress, taking you to your dashboard...", "success");
    } else {
      showStatus(finalResult.error, "error");
    }
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
  } catch (err) {
    showStatus("Something went wrong: " + err.message + ". Please check your dashboard.", "error");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
  }
}

document.getElementById("checkForm").addEventListener("submit", submitCheckOrder);

document.addEventListener("DOMContentLoaded", loadConfigAndInit);
