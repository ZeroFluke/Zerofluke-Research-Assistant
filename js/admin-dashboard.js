const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";

const role = localStorage.getItem("zfa_role");
const staffId = localStorage.getItem("zfa_staffId");
const sessionToken = localStorage.getItem("zfa_sessionToken");

if (!role || !sessionToken) {
  window.location.href = "login.html";
}

const ORDER_STATUSES = ["Request Pending", "Ongoing", "Completed", "Cancelled"];
const CHECK_STATUSES = ["Requested", "Paid", "Ongoing", "Report Ready", "Completed"];
const SPECIAL_LEVELS = ["Proofreading", "Literature Review"];

const data = { orders: [], checkOrders: [], complaints: [], staff: [], activityLog: [] };

function showStatus(message, type) {
  const box = document.getElementById("statusBox");
  box.textContent = message;
  box.className = "status-box show status-" + type;
  setTimeout(() => { box.className = "status-box"; }, 4000);
}

function adminCall(action, extra) {
  const payload = Object.assign({ action: action, role: role, staffId: staffId, sessionToken: sessionToken }, extra || {});
  return fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------- Top bar ----------

document.getElementById("whoLabel").textContent = role === "owner" ? "Owner" : staffId;

document.getElementById("logoutBtn").addEventListener("click", function () {
  localStorage.removeItem("zfa_role");
  localStorage.removeItem("zfa_staffId");
  localStorage.removeItem("zfa_sessionToken");
  localStorage.removeItem("zfa_fullName");
  window.location.href = "login.html";
});

if (role === "owner") {
  document.getElementById("staffTabBtn").style.display = "inline-block";
  document.getElementById("activityLogTabBtn").style.display = "inline-block";
} else {
  document.getElementById("changePasswordBtn").style.display = "inline-block";
}

document.getElementById("refreshAllBtn").addEventListener("click", async function () {
  showStatus("Refreshing...", "info");
  await loadAll();
  renderActiveTab();
  showStatus("Up to date.", "success");
});

// ---------- Tabs ----------

document.querySelectorAll(".admin-tab").forEach((btn) => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    renderTab(btn.dataset.tab);
  });
});

function activeTabName() {
  const active = document.querySelector(".admin-tab.active");
  return active ? active.dataset.tab : "orders";
}

function renderActiveTab() {
  renderTab(activeTabName());
}

function renderTab(tab) {
  if (tab === "orders") renderOrders(data.orders);
  if (tab === "checkOrders") renderCheckOrders(data.checkOrders);
  if (tab === "complaints") renderComplaints(data.complaints);
  if (tab === "staff") renderStaff(data.staff);
  if (tab === "activityLog") renderActivityLog(data.activityLog);
}

// ---------- Load everything once, in parallel ----------

async function loadAll() {
  try {
    const ordersResult = await adminCall("adminGetAllOrders");
    if (ordersResult.success) data.orders = ordersResult.orders;

    const checkResult = await adminCall("adminGetAllCheckOrders");
    if (checkResult.success) data.checkOrders = checkResult.checkOrders;

    const complaintsResult = await adminCall("adminGetComplaints");
    if (complaintsResult.success) data.complaints = complaintsResult.complaints;

    if (role === "owner") {
      const staffResult = await adminCall("adminGetStaff");
      if (staffResult.success) data.staff = staffResult.staff;

      const logResult = await adminCall("adminGetActivityLog");
      if (logResult.success) data.activityLog = logResult.log;
    }
  } catch (err) {
    showStatus("Some data failed to load: " + err.message + ". Try Refresh All.", "error");
  }
}

// ---------- Orders ----------

function renderOrders(orders) {
  const container = document.getElementById("ordersList");

  if (orders.length === 0) {
    container.innerHTML = '<p class="admin-empty">No orders yet.</p>';
    return;
  }

  container.innerHTML = orders.map((o) => {
    const statusOptions = ORDER_STATUSES.map((s) =>
      '<option value="' + s + '"' + (s === o.orderStatus ? " selected" : "") + ">" + s + "</option>"
    ).join("");

    const isSpecial = SPECIAL_LEVELS.indexOf(o.academicLevel) !== -1;
    let specialLine = "";
    if (o.academicLevel === "Proofreading") {
      specialLine = '<div class="admin-row-meta">Pages: ' + (o.specialOrderQuantity || "—") +
        (o.specialOrderDocumentLink ? ' · <a href="' + o.specialOrderDocumentLink + '" target="_blank">View submitted document</a>' : "") + "</div>";
    } else if (o.academicLevel === "Literature Review") {
      specialLine = '<div class="admin-row-meta">Works to review: ' + (o.specialOrderQuantity || "—") +
        " · For: " + (o.literatureReviewFor || "—") + "</div>";
    }

    return (
      '<div class="admin-row" data-order-id="' + o.orderId + '">' +
        '<div class="admin-row-top">' +
          '<div>' +
            '<div class="admin-row-title">' + o.topic + (isSpecial ? ' <span class="pill">' + o.academicLevel + "</span>" : "") + "</div>" +
            '<div class="admin-row-meta">' + o.clientName + " (" + o.clientEmail + ")" + (isSpecial ? "" : " — " + o.academicLevel) + "</div>" +
          "</div>" +
          '<span class="pill">' + o.orderStatus + "</span>" +
        "</div>" +
        specialLine +
        '<div class="admin-row-meta">Paid ' + (o.amountPaidSoFar || 0) + " / " + o.totalPrice + " · Revisits " + o.revisitsUsed + "/" + o.revisitsPurchased + " · Last updated by " + (o.lastUpdatedBy || "—") + "</div>" +
        '<div class="admin-row-controls">' +
          '<select class="status-select">' + statusOptions + "</select>" +
          '<button class="btn btn-outline-dark btn-save-status">Save Status</button>' +
          '<label class="btn btn-outline-dark" style="margin:0;">Upload Word<input type="file" class="file-word" style="display:none;"></label>' +
          '<label class="btn btn-outline-dark" style="margin:0;">Upload PDF<input type="file" class="file-pdf" style="display:none;"></label>' +
        "</div>" +
      "</div>"
    );
  }).join("");

  container.querySelectorAll(".admin-row").forEach((row) => {
    const orderId = row.dataset.orderId;

    row.querySelector(".btn-save-status").addEventListener("click", async () => {
      const newStatus = row.querySelector(".status-select").value;
      const result = await adminCall("adminUpdateOrder", { orderId: orderId, newStatus: newStatus });
      showStatus(result.success ? "Status updated." : result.error, result.success ? "success" : "error");
      if (result.success) await refreshOrders();
    });

    row.querySelector(".file-word").addEventListener("change", async (e) => {
      await uploadOrderFile(orderId, e.target.files[0], "finalWord");
    });
    row.querySelector(".file-pdf").addEventListener("change", async (e) => {
      await uploadOrderFile(orderId, e.target.files[0], "finalPdf");
    });
  });
}

async function refreshOrders() {
  const result = await adminCall("adminGetAllOrders");
  if (result.success) {
    data.orders = result.orders;
    renderOrders(data.orders);
  }
}

async function uploadOrderFile(orderId, file, slot) {
  if (!file) return;
  showStatus("Uploading...", "info");
  try {
    const base64Data = await fileToBase64(file);
    const result = await adminCall("adminUploadFile", {
      targetType: "order",
      targetId: orderId,
      slot: slot,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Data: base64Data
    });
    showStatus(result.success ? "File delivered to client." : result.error, result.success ? "success" : "error");
    if (result.success) await refreshOrders();
  } catch (err) {
    showStatus("Upload failed: " + err.message, "error");
  }
}

// ---------- Check Orders ----------

function renderCheckOrders(checkOrders) {
  const container = document.getElementById("checkOrdersList");

  if (checkOrders.length === 0) {
    container.innerHTML = '<p class="admin-empty">No check orders yet.</p>';
    return;
  }

  container.innerHTML = checkOrders.map((c) => {
    const statusOptions = CHECK_STATUSES.map((s) =>
      '<option value="' + s + '"' + (s === c.orderStatus ? " selected" : "") + ">" + s + "</option>"
    ).join("");
    const canUpload = c.orderStatus === "Ongoing";

    return (
      '<div class="admin-row" data-check-id="' + c.checkId + '">' +
        '<div class="admin-row-top">' +
          '<div>' +
            '<div class="admin-row-title">' + c.checkTypes + " Check</div>" +
            '<div class="admin-row-meta">' + c.clientName + " (" + c.clientEmail + ")" + (c.exclusions ? " · Exclusions: " + c.exclusions : "") + "</div>" +
          "</div>" +
          '<span class="pill">' + c.orderStatus + "</span>" +
        "</div>" +
        '<div class="admin-row-meta">₦' + c.amount + " · Last updated by " + (c.lastUpdatedBy || "—") + "</div>" +
        '<div class="admin-row-controls">' +
          '<select class="status-select">' + statusOptions + "</select>" +
          '<button class="btn btn-outline-dark btn-save-status">Save Status</button>' +
          (canUpload
            ? '<label class="btn btn-outline-dark" style="margin:0;">Upload Report<input type="file" class="file-report" style="display:none;"></label>'
            : '<span class="admin-row-meta">Upload available once status is Ongoing</span>') +
        "</div>" +
      "</div>"
    );
  }).join("");

  container.querySelectorAll(".admin-row").forEach((row) => {
    const checkId = row.dataset.checkId;

    row.querySelector(".btn-save-status").addEventListener("click", async () => {
      const newStatus = row.querySelector(".status-select").value;
      const result = await adminCall("adminUpdateCheckOrder", { checkId: checkId, newStatus: newStatus });
      showStatus(result.success ? "Status updated." : result.error, result.success ? "success" : "error");
      if (result.success) await refreshCheckOrders();
    });

    const fileInput = row.querySelector(".file-report");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showStatus("Uploading...", "info");
        try {
          const base64Data = await fileToBase64(file);
          const result = await adminCall("adminUploadFile", {
            targetType: "checkOrder",
            targetId: checkId,
            slot: "report",
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            base64Data: base64Data
          });
          showStatus(result.success ? "Report delivered, status set to Report Ready." : result.error, result.success ? "success" : "error");
          if (result.success) await refreshCheckOrders();
        } catch (err) {
          showStatus("Upload failed: " + err.message, "error");
        }
      });
    }
  });
}

async function refreshCheckOrders() {
  const result = await adminCall("adminGetAllCheckOrders");
  if (result.success) {
    data.checkOrders = result.checkOrders;
    renderCheckOrders(data.checkOrders);
  }
}

// ---------- Complaints ----------

function renderComplaints(complaints) {
  const container = document.getElementById("complaintsList");

  if (complaints.length === 0) {
    container.innerHTML = '<p class="admin-empty">No complaints yet.</p>';
    return;
  }

  const sorted = complaints.slice().reverse();

  container.innerHTML = sorted.map((c) => {
    const isResolved = c.resolved === true || c.resolved === "TRUE";
    return (
      '<div class="admin-row" data-complaint-id="' + c.complaintId + '">' +
        '<div class="admin-row-top">' +
          '<div>' +
            '<div class="admin-row-title">' + c.topic + " — " + c.name + "</div>" +
            '<div class="admin-row-meta">' + c.email + (c.relatedOrderId ? " · Order: " + c.relatedOrderId : "") + " · " + formatDate(c.timestamp) + "</div>" +
          "</div>" +
          '<span class="pill' + (isResolved ? " resolved" : "") + '">' + (isResolved ? "Resolved" : "Open") + "</span>" +
        "</div>" +
        '<p style="margin:0.5rem 0;font-size:0.9rem;">' + c.message + "</p>" +
        (isResolved
          ? '<div class="admin-row-meta">Resolved by ' + c.resolvedBy + " on " + formatDate(c.resolvedTimestamp) + "</div>"
          : '<div class="admin-row-controls"><button class="btn btn-primary btn-resolve">Mark Resolved</button></div>') +
      "</div>"
    );
  }).join("");

  container.querySelectorAll(".btn-resolve").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const complaintId = this.closest(".admin-row").dataset.complaintId;
      const result = await adminCall("adminResolveComplaint", { complaintId: complaintId });
      showStatus(result.success ? "Complaint resolved." : result.error, result.success ? "success" : "error");
      if (result.success) {
        const r = await adminCall("adminGetComplaints");
        if (r.success) {
          data.complaints = r.complaints;
          renderComplaints(data.complaints);
        }
      }
    });
  });
}

// ---------- Staff (owner only) ----------

function renderStaff(staff) {
  const container = document.getElementById("staffList");

  if (staff.length === 0) {
    container.innerHTML = '<p class="admin-empty">No staff invited yet.</p>';
    return;
  }

  container.innerHTML = staff.map((s) =>
    '<div class="admin-row">' +
      '<div class="admin-row-top">' +
        '<div>' +
          '<div class="admin-row-title">' + s.fullName + '</div>' +
          '<div class="admin-row-meta">' + s.staffId + " · " + s.email + "</div>" +
        "</div>" +
        '<span class="pill' + (s.inviteStatus === "Active" ? " resolved" : "") + '">' + s.inviteStatus + "</span>" +
      "</div>" +
      '<div class="admin-row-meta">Invited ' + formatDate(s.invitedTimestamp) + " · Last login " + formatDate(s.lastLogin) + "</div>" +
    "</div>"
  ).join("");
}

document.getElementById("inviteForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const btn = document.getElementById("inviteBtn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  const result = await adminCall("inviteStaff", {
    fullName: document.getElementById("inv-name").value.trim(),
    email: document.getElementById("inv-email").value.trim()
  });

  btn.disabled = false;
  btn.textContent = "Send Invite";

  if (result.success) {
    showStatus("Invite sent — Staff ID " + result.staffId, "success");
    document.getElementById("inviteForm").reset();
    const r = await adminCall("adminGetStaff");
    if (r.success) {
      data.staff = r.staff;
      renderStaff(data.staff);
    }
  } else {
    showStatus(result.error, "error");
  }
});

// ---------- Activity Log (owner only) ----------

function renderActivityLog(log) {
  const container = document.getElementById("activityLogList");

  if (log.length === 0) {
    container.innerHTML = '<p class="admin-empty">No activity recorded yet.</p>';
    return;
  }

  const sorted = log.slice().reverse();

  container.innerHTML = sorted.map((entry) =>
    '<div class="admin-row">' +
      '<div class="admin-row-top">' +
        '<div>' +
          '<div class="admin-row-title">' + entry.staffId + '</div>' +
          '<div class="admin-row-meta">' + entry.action + "</div>" +
        "</div>" +
        '<span class="admin-row-meta">' + formatDate(entry.timestamp) + "</span>" +
      "</div>" +
      (entry.refId ? '<div class="admin-row-meta">Ref: ' + entry.refId + "</div>" : "") +
    "</div>"
  ).join("");
}

// ---------- Change Password (staff only) ----------

const cpModal = document.getElementById("changePasswordModal");

function showCpStatus(message, type) {
  const box = document.getElementById("cpStatusBox");
  box.textContent = message;
  box.className = "status-box show status-" + type;
}

if (document.getElementById("changePasswordBtn")) {
  document.getElementById("changePasswordBtn").addEventListener("click", () => {
    document.getElementById("changePasswordForm").reset();
    document.getElementById("cpStatusBox").className = "status-box";
    cpModal.classList.add("open");
  });
}

document.getElementById("cpCancelBtn").addEventListener("click", () => {
  cpModal.classList.remove("open");
});

document.getElementById("changePasswordForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const currentPassword = document.getElementById("cp-current").value;
  const newPassword = document.getElementById("cp-new").value;

  const result = await adminCall("staffChangePassword", { currentPassword: currentPassword, newPassword: newPassword });

  if (result.success) {
    showCpStatus("Password updated.", "success");
    setTimeout(() => { cpModal.classList.remove("open"); }, 1200);
  } else {
    showCpStatus(result.error, "error");
  }
});

// ---------- Initial load ----------

(async function init() {
  await loadAll();
  renderActiveTab();
})();
