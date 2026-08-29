const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";

// ---------- Session guard (runs immediately, before DOM is even ready) ----------
const zfClientId = localStorage.getItem("zf_clientId");
if (!zfClientId) {
  window.location.href = "login.html";
}

let currentOrders = [];
let currentEmail = localStorage.getItem("zf_email") || "";
let revisitFee = 0;
let currentFilter = "All";

function callBackend(payload) {
  return fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

async function loadRevisitFee() {
  try {
    const result = await callBackend({ action: "getPricingConfig" });
    if (result.success) revisitFee = Number(result.revisitFee) || 0;
  } catch (err) {
    console.error(err);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString("en-NG");
}

function formatDate(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(status) {
  if (status === "Ongoing") return "ongoing";
  if (status === "Completed") return "completed";
  if (status === "Cancelled") return "cancelled";
  return "pending";
}

// ---------- Load dashboard ----------
async function loadDashboard() {
  const container = document.getElementById("ordersContainer");
  try {
    const result = await callBackend({ action: "getDashboard", clientId: zfClientId });

    if (!result.success) {
      // Client row is gone or otherwise invalid — clear the stale session and send back to login.
      localStorage.removeItem("zf_clientId");
      localStorage.removeItem("zf_fullName");
      localStorage.removeItem("zf_email");
      window.location.href = "login.html";
      return;
    }

    currentOrders = result.orders || [];
    currentEmail = result.email || currentEmail;
    localStorage.setItem("zf_fullName", result.fullName);
    localStorage.setItem("zf_email", result.email);

    document.getElementById("welcomeHeading").textContent = "Welcome back, " + result.fullName.split(" ")[0];

    if (currentOrders.length) {
      document.getElementById("filterRow").style.display = "flex";
    }

    renderOrders(getFilteredOrders());
  } catch (err) {
    container.innerHTML = '<div class="dashboard-empty"><p>Could not load your dashboard right now. Please refresh.</p></div>';
    console.error(err);
  }
}

function orderTimestamp(orderId) {
  return Number(String(orderId).replace(/^OR/, "")) || 0;
}

function getFilteredOrders() {
  const sorted = [...currentOrders].sort((a, b) => orderTimestamp(b.orderId) - orderTimestamp(a.orderId));
  if (currentFilter === "All") return sorted;
  return sorted.filter((o) => o.orderStatus === currentFilter);
}

document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    renderOrders(getFilteredOrders());
  });
});

function renderOrders(orders) {
  const container = document.getElementById("ordersContainer");

  if (!orders.length) {
    container.innerHTML =
      '<div class="dashboard-empty"><p>You don\'t have any orders yet.</p>' +
      '<a href="order.html" class="btn btn-primary" style="margin-top:1rem;">Place your first request</a></div>';
    return;
  }

  container.innerHTML = orders.map(buildOrderCardHtml).join("");

  orders.forEach((order) => wireOrderCard(order));
}

function buildOrderCardHtml(order) {
  const revisitsRemaining = order.revisitsRemaining;
  const balanceOutstanding = order.paymentPlan === "70/30" && Number(order.amountPaidSoFar) < Number(order.totalPrice);

  let fieldworkNote = "";
  if (order.isScience) {
    fieldworkNote = Number(order.fieldworkQuoteAmount) > 0
      ? '<p class="field-hint">Fieldwork quote: ' + formatNaira(order.fieldworkQuoteAmount) + '</p>'
      : '<p class="field-hint">A separate fieldwork quote is pending from our team.</p>';
  }

  let actionsHtml = "";

  if (order.orderStatus === "Request Pending") {
    actionsHtml =
      '<div class="order-actions">' +
      '<button class="btn btn-primary" data-action="pay" data-type="Upfront-70">Pay Upfront (70%)</button>' +
      '<button class="btn btn-outline-dark" data-action="pay" data-type="Full">Pay in Full (discount)</button>' +
      '<button class="btn btn-ghost" data-action="cancel" style="color:var(--danger);border-color:var(--line);">Cancel Request</button>' +
      '</div>' +
      '<div class="payment-wait-area"></div>';
  } else if (order.orderStatus === "Ongoing") {
    actionsHtml =
      (balanceOutstanding
        ? '<div class="order-actions"><button class="btn btn-primary" data-action="pay" data-type="Balance-30">Pay Balance (30%)</button></div><div class="payment-wait-area"></div>'
        : "") +
      '<div class="revisit-upload-row">' +
      (revisitsRemaining > 0
        ? '<form data-action="upload-revisit" style="display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;">' +
          '<input type="file" accept="image/*,.pdf,.doc,.docx" required>' +
          '<button type="submit" class="btn btn-outline-dark">Upload Supervisor Comment</button>' +
          '<span class="field-hint">' + revisitsRemaining + ' revisit(s) remaining</span>' +
          '</form>'
        : '<p class="field-hint" style="margin:0;">No revisits remaining. Top up below to continue.</p>') +
      '</div>' +
      '<div class="revisit-upload-row topup-row">' +
      '<button class="btn btn-outline-dark" data-action="topup-toggle">Add Revisits</button>' +
      '<div class="topup-picker" style="display:none;align-items:center;gap:0.6rem;">' +
      '<label class="field-hint" style="margin:0;">How many?</label>' +
      '<input type="number" min="1" max="10" value="1" class="topup-count">' +
      '<button class="btn btn-primary" data-action="topup-confirm">Add Revisits</button>' +
      '</div>' +
      '</div>' +
      '<div class="payment-wait-area topup-wait-area"></div>' +
      '<div class="order-actions">' +
      '<button class="btn btn-ghost" data-action="satisfactory" style="color:var(--deep-navy);border-color:var(--line);">Mark as Satisfactory</button>' +
      '<button class="btn btn-ghost" data-action="request-update" style="color:var(--royal-blue);border-color:var(--line);">Request Update</button>' +
      (Number(order.amountPaidSoFar) > 0
        ? '<button class="btn btn-ghost" data-action="withdraw" style="color:var(--danger);border-color:var(--line);">Withdraw / Request Refund</button>'
        : "") +
      '</div>';
  } else if (order.orderStatus === "Completed") {
    let files = "";
    if (order.finalWordFileLink) files += '<a href="' + order.finalWordFileLink + '" target="_blank" class="btn btn-outline-dark" style="margin-right:0.5rem;">Download (Word)</a>';
    if (order.finalPdfFileLink) files += '<a href="' + order.finalPdfFileLink + '" target="_blank" class="btn btn-outline-dark">Download (PDF)</a>';
    actionsHtml = '<div class="order-actions">' + (files || '<p class="field-hint" style="margin:0;">Final files will appear here once uploaded.</p>') + '</div>';
  } else if (order.orderStatus === "Cancelled") {
    actionsHtml = '<p class="field-hint" style="margin:0;">This order was cancelled. <a href="contact.html" style="color:var(--royal-blue);font-weight:600;">Contact us</a> if you\'d like to resume it.</p>';
  }

  return (
    '<div class="order-card" data-order-id="' + order.orderId + '">' +
    '<div class="order-card-head">' +
    '<div><h3 style="margin-bottom:0.15rem;">' + (order.topic || order.academicLevel + " Research") + '</h3>' +
    '<p class="field-hint" style="margin:0;">' + order.academicLevel + " · " + order.fieldProgramme + '</p></div>' +
    '<span class="status-pill ' + statusClass(order.orderStatus) + '">' + order.orderStatus + '</span>' +
    '</div>' +
    '<div class="order-meta-grid">' +
    '<div><div class="label">Total Price</div><div class="value">' + formatNaira(order.totalPrice) + '</div></div>' +
    '<div><div class="label">Paid So Far</div><div class="value">' + formatNaira(order.amountPaidSoFar) + '</div></div>' +
    '<div><div class="label">Revisits</div><div class="value">' + order.revisitsUsed + '/' + order.revisitsPurchased + ' used</div></div>' +
    '<div><div class="label">Target Completion</div><div class="value">' + formatDate(order.targetCompletionDate) + '</div></div>' +
    '</div>' +
    fieldworkNote +
    (order.orderFolderLink ? '<p class="field-hint"><a href="' + order.orderFolderLink + '" target="_blank" style="color:var(--royal-blue);">View documents folder</a></p>' : "") +
    actionsHtml +
    '</div>'
  );
}

// ---------- Wiring per rendered card ----------
function wireOrderCard(order) {
  const card = document.querySelector('.order-card[data-order-id="' + order.orderId + '"]');
  if (!card) return;

  // Pay buttons
  card.querySelectorAll('[data-action="pay"]').forEach((btn) => {
    btn.addEventListener("click", () => startPayment(order.orderId, btn.dataset.type, card.querySelector(".payment-wait-area")));
  });

  // Mark satisfactory
  const satBtn = card.querySelector('[data-action="satisfactory"]');
  if (satBtn) {
    satBtn.addEventListener("click", () => markSatisfactory(order.orderId));
  }

  // Cancel (unpaid orders only)
  const cancelBtn = card.querySelector('[data-action="cancel"]');
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => cancelOrder(order.orderId));
  }

  // Withdraw / refund (paid orders, within backend's refund window)
  const withdrawBtn = card.querySelector('[data-action="withdraw"]');
  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", () => openWithdrawModal(order.orderId));
  }

  // Request an update (reuses the complaints system, prefilled)
  const requestUpdateBtn = card.querySelector('[data-action="request-update"]');
  if (requestUpdateBtn) {
    requestUpdateBtn.addEventListener("click", () => requestOrderUpdate(order.orderId));
  }

  // Revisit upload form
  const uploadForm = card.querySelector('form[data-action="upload-revisit"]');
  if (uploadForm) {
    uploadForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const file = uploadForm.querySelector('input[type="file"]').files[0];
      if (file) uploadRevisit(order.orderId, file, uploadForm);
    });
  }

  // Top up: reveal picker, then confirm with cost shown before charging
  const topupToggleBtn = card.querySelector('[data-action="topup-toggle"]');
  if (topupToggleBtn) {
    topupToggleBtn.addEventListener("click", () => {
      const picker = card.querySelector(".topup-picker");
      picker.style.display = picker.style.display === "none" ? "flex" : "none";
    });
  }
  const topupConfirmBtn = card.querySelector('[data-action="topup-confirm"]');
  if (topupConfirmBtn) {
    topupConfirmBtn.addEventListener("click", () => {
      const count = Number(card.querySelector(".topup-count").value);
      if (!count || count < 1) {
        showStatus("Enter how many revisits you'd like to add.", "error");
        return;
      }
      const costText = revisitFee ? " at " + formatNaira(count * revisitFee) : "";
      if (!confirm("Add " + count + " revisit(s)" + costText + "? This will open payment for that amount.")) return;
      topupRevisits(order.orderId, count, card.querySelector(".topup-wait-area"));
    });
  }
}

// ---------- Payments ----------
const PAYSTACK_PUBLIC_KEY = "pk_test_cddc8c3744db3437e87cf07597f4a7cc0411cb91";

async function startPayment(orderId, paymentType, waitArea) {
  clearStatus();
  try {
    const result = await callBackend({
      action: "initializePayment",
      orderId: orderId,
      clientId: zfClientId,
      email: currentEmail,
      paymentType: paymentType
    });

    if (!result.success) {
      showStatus(result.error, "error");
      return;
    }

    openPaystackPopup(result.reference, result.amount, result.email, waitArea);
  } catch (err) {
    showStatus("Something went wrong starting payment: " + err.message, "error");
  }
}

function openPaystackPopup(reference, amount, email, waitArea) {
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: Math.round(amount * 100),
    ref: reference,
    callback: function (response) {
      confirmPayment(response.reference, waitArea);
    },
    onClose: function () {
      showStatus("Payment window closed. No charge was made.", "info");
    }
  });
  handler.openIframe();
}

async function confirmPayment(reference, waitArea) {
  clearStatus();
  showStatus("Confirming your payment...", "info");
  try {
    const result = await callBackend({ action: "verifyPayment", reference: reference });
    if (result.success) {
      showStatus("Payment confirmed. Updating your dashboard...", "success");
    } else {
      showStatus("We couldn't confirm that payment yet. If you completed it, this can take a moment, try Refresh shortly.", "error");
    }
  } catch (err) {
    showStatus("Something went wrong confirming payment: " + err.message, "error");
  }
  loadDashboard();
}

// ---------- Revisits ----------
async function uploadRevisit(orderId, file, formEl) {
  clearStatus();
  const btn = formEl.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Uploading...";

  try {
    const base64Data = await fileToBase64(file);
    const uploadResult = await callBackend({
      action: "uploadFile",
      fileName: file.name,
      mimeType: file.type,
      base64Data: base64Data,
      folderName: "ZeroFluke Revisit Comments"
    });

    if (!uploadResult.success) {
      showStatus("There was a problem uploading that file. Please try again.", "error");
      btn.disabled = false;
      btn.textContent = "Upload Supervisor Comment";
      return;
    }

    const result = await callBackend({
      action: "uploadRevisit",
      orderId: orderId,
      clientId: zfClientId,
      supervisorCommentFileLink: uploadResult.fileUrl
    });

    if (result.success) {
      showStatus("Supervisor comment uploaded. " + result.revisitsRemaining + " revisit(s) remaining.", "success");
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
  }

  loadDashboard();
}

async function topupRevisits(orderId, revisitCount, waitArea) {
  clearStatus();
  if (!revisitCount || revisitCount < 1) {
    showStatus("Enter how many revisits you'd like to add.", "error");
    return;
  }

  try {
    const result = await callBackend({
      action: "topupRevisits",
      orderId: orderId,
      clientId: zfClientId,
      revisitCount: revisitCount
    });

    if (!result.success) {
      showStatus(result.error, "error");
      return;
    }

    const payResult = await callBackend({
      action: "initializeTopupPayment",
      paymentId: result.paymentId,
      email: currentEmail
    });

    if (!payResult.success) {
      showStatus("Revisits were added, but starting payment failed: " + payResult.error, "error");
      return;
    }

    openPaystackPopup(payResult.reference, payResult.amount, payResult.email, waitArea);
    showStatus(result.revisitsAdded + " revisit(s) added. Complete payment of " + formatNaira(result.cost) + " in the payment window.", "info");
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
  }
}

async function markSatisfactory(orderId) {
  clearStatus();
  if (!confirm("Mark this order as satisfactory? This closes the order.")) return;

  try {
    const result = await callBackend({ action: "markSatisfactory", orderId: orderId, clientId: zfClientId });
    if (result.success) {
      showStatus("Order marked as completed. Thank you.", "success");
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
  }
  loadDashboard();
}

async function cancelOrder(orderId) {
  clearStatus();
  if (!confirm("Cancel this request? This cannot be undone.")) return;

  try {
    const result = await callBackend({ action: "cancelOrder", orderId: orderId, clientId: zfClientId });
    if (result.success) {
      showStatus("Request cancelled.", "success");
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
  }
  loadDashboard();
}

async function requestOrderUpdate(orderId) {
  clearStatus();
  if (!confirm("Send a request for an update on order " + orderId + "? Our team will reply by email.")) return;

  try {
    const result = await callBackend({
      action: "submitComplaint",
      name: localStorage.getItem("zf_fullName") || "",
      email: localStorage.getItem("zf_email") || "",
      topic: "Order status/complaint",
      relatedOrderId: orderId,
      message: "I'd like an update on the progress of this order."
    });
    if (result.success) {
      showStatus("Update request sent. We'll reply by email soon.", "success");
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    showStatus("Something went wrong: " + err.message, "error");
  }
}

// ---------- Withdraw / refund modal ----------
let withdrawTargetOrderId = null;

function openWithdrawModal(orderId) {
  withdrawTargetOrderId = orderId;
  document.getElementById("withdrawReasonSelect").value = "";
  document.getElementById("withdrawOtherText").value = "";
  document.getElementById("withdrawOtherField").style.display = "none";
  document.getElementById("withdrawContinueBtn").disabled = true;
  document.getElementById("withdrawStepReason").style.display = "";
  document.getElementById("withdrawStepConfirm").style.display = "none";
  document.getElementById("withdrawOrderIdLabel").textContent = orderId;
  document.getElementById("withdrawModal").classList.add("open");
}

function closeWithdrawModal() {
  document.getElementById("withdrawModal").classList.remove("open");
  withdrawTargetOrderId = null;
}

function currentWithdrawReason() {
  const selected = document.getElementById("withdrawReasonSelect").value;
  if (selected === "Other") {
    return document.getElementById("withdrawOtherText").value.trim();
  }
  return selected;
}

document.getElementById("withdrawReasonSelect").addEventListener("change", function () {
  const isOther = this.value === "Other";
  document.getElementById("withdrawOtherField").style.display = isOther ? "" : "none";
  document.getElementById("withdrawContinueBtn").disabled = isOther ? true : !this.value;
});

document.getElementById("withdrawOtherText").addEventListener("input", function () {
  document.getElementById("withdrawContinueBtn").disabled = this.value.trim().length === 0;
});

document.getElementById("withdrawCancelBtn").addEventListener("click", closeWithdrawModal);
document.getElementById("withdrawBackBtn").addEventListener("click", () => {
  document.getElementById("withdrawStepReason").style.display = "";
  document.getElementById("withdrawStepConfirm").style.display = "none";
});

document.getElementById("withdrawContinueBtn").addEventListener("click", () => {
  document.getElementById("withdrawStepReason").style.display = "none";
  document.getElementById("withdrawStepConfirm").style.display = "";
});

document.getElementById("withdrawConfirmBtn").addEventListener("click", async () => {
  const orderId = withdrawTargetOrderId;
  const reason = currentWithdrawReason();
  const btn = document.getElementById("withdrawConfirmBtn");
  btn.disabled = true;
  btn.textContent = "Processing...";

  clearStatus();
  try {
    const result = await callBackend({ action: "requestRefund", orderId: orderId, clientId: zfClientId, reason: reason });
    closeWithdrawModal();
    if (result.success) {
      showStatus(result.message, "success");
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    closeWithdrawModal();
    showStatus("Something went wrong: " + err.message, "error");
  }

  btn.disabled = false;
  btn.textContent = "Yes, cancel and refund";
  loadDashboard();
});

document.getElementById("refreshBtn") && document.getElementById("refreshBtn").addEventListener("click", loadDashboard);
document.addEventListener("DOMContentLoaded", () => {
  loadRevisitFee();
  loadDashboard();
});
