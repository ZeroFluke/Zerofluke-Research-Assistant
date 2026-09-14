const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";

function showStatus(message, type) {
  const box = document.getElementById("statusBox");
  box.textContent = message;
  box.className = "status-box show status-" + type;
}

function callBackend(payload) {
  return fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

// If already logged in as admin/staff, skip straight to the dashboard.
document.addEventListener("DOMContentLoaded", function () {
  if (localStorage.getItem("zfa_sessionToken")) {
    window.location.href = "dashboard.html";
  }
});

document.getElementById("adminLoginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("al-email").value.trim();
  const password = document.getElementById("al-password").value;
  const btn = document.getElementById("adminLoginBtn");

  btn.disabled = true;
  btn.textContent = "Logging in...";

  try {
    const result = await callBackend({
      action: "adminOrStaffLogin",
      email: email,
      password: password
    });

    if (!result.success) {
      showStatus(result.error, "error");
      btn.disabled = false;
      btn.textContent = "Log In";
      return;
    }

    localStorage.setItem("zfa_role", result.role);
    localStorage.setItem("zfa_staffId", result.staffId);
    localStorage.setItem("zfa_sessionToken", result.sessionToken);
    localStorage.setItem("zfa_fullName", result.fullName || "Owner");

    showStatus("Welcome back. Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 600);
  } catch (err) {
    showStatus("Something went wrong. Please try again.", "error");
    btn.disabled = false;
    btn.textContent = "Log In";
  }
});
