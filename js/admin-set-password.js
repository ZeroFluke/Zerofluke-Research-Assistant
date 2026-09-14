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

const inviteToken = new URLSearchParams(window.location.search).get("token");

if (!inviteToken) {
  document.getElementById("setPasswordForm").style.display = "none";
  showStatus("This link is missing an invite code. Please contact the admin for a new invite.", "error");
}

document.getElementById("setPasswordForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const password = document.getElementById("sp-password").value;
  const confirm = document.getElementById("sp-confirm").value;
  const btn = document.getElementById("setPasswordBtn");

  if (password !== confirm) {
    showStatus("Passwords do not match.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Activating...";

  try {
    const result = await callBackend({ action: "setStaffPassword", token: inviteToken, newPassword: password });
    btn.disabled = false;
    btn.textContent = "Activate Account";

    if (result.success) {
      showStatus(result.message + " Redirecting to log in...", "success");
      document.getElementById("setPasswordForm").reset();
      setTimeout(() => { window.location.href = "login.html"; }, 1500);
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Activate Account";
    showStatus("Something went wrong: " + err.message, "error");
  }
});
