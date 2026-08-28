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

const resetToken = new URLSearchParams(window.location.search).get("token");

if (!resetToken) {
  document.getElementById("resetForm").style.display = "none";
  showStatus("This link is missing a reset code. Please request a new one from the Forgot Password page.", "error");
}

document.getElementById("resetForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const password = document.getElementById("rp-password").value;
  const confirm = document.getElementById("rp-confirm").value;
  const btn = document.getElementById("resetSubmitBtn");

  if (password !== confirm) {
    showStatus("Passwords do not match.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    const result = await callBackend({ action: "resetPassword", token: resetToken, newPassword: password });
    btn.disabled = false;
    btn.textContent = "Update Password";

    if (result.success) {
      showStatus(result.message + " Redirecting to log in...", "success");
      document.getElementById("resetForm").reset();
      setTimeout(() => { window.location.href = "login.html"; }, 1500);
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Update Password";
    showStatus("Something went wrong: " + err.message, "error");
  }
});
