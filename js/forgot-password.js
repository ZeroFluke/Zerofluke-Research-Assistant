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

document.getElementById("forgotForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const email = document.getElementById("fp-email").value.trim();
  const btn = document.getElementById("forgotSubmitBtn");

  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const result = await callBackend({ action: "requestPasswordReset", email: email });
    btn.disabled = false;
    btn.textContent = "Send Reset Link";

    if (result.success) {
      showStatus(result.message, "success");
      document.getElementById("forgotForm").reset();
    } else {
      showStatus(result.error, "error");
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Send Reset Link";
    showStatus("Something went wrong: " + err.message, "error");
  }
});
