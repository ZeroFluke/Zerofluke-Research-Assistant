const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";
const GOOGLE_CLIENT_ID = "305149507909-stpai58m35c6tmjjfr4cclgojjrau068.apps.googleusercontent.com";

function showStatus(message, type) {
  const box = document.getElementById("statusBox");
  box.textContent = message;
  box.className = "status-box show status-" + type;
}

function clearStatus() {
  const box = document.getElementById("statusBox");
  box.className = "status-box";
}

function callBackend(payload) {
  return fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

function saveSessionAndGoToDashboard(clientId, fullName, email, welcomeMessage) {
  localStorage.setItem("zf_clientId", clientId);
  localStorage.setItem("zf_fullName", fullName);
  localStorage.setItem("zf_email", email);
  showStatus(welcomeMessage, "success");
  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 800);
}

// If someone's already logged in and lands back on the login page, just
// send them straight to the dashboard instead of asking them to log in again.
window.addEventListener("DOMContentLoaded", function () {
  if (localStorage.getItem("zf_clientId")) {
    window.location.href = "dashboard.html";
  }
});

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  clearStatus();

  const email = document.getElementById("li-email").value.trim();
  const password = document.getElementById("li-password").value;
  const submitBtn = document.getElementById("loginSubmitBtn");

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const result = await callBackend({ action: "login", email: email, password: password });

    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";

    if (result.success) {
      saveSessionAndGoToDashboard(result.clientId, result.fullName, email, "Welcome back, " + result.fullName + ". Redirecting...");
    } else {
      showStatus(result.error, "error");
      // handleLogin returns this exact message for both a wrong password and an
      // unrecognized email (deliberately, so failed attempts can't be used to
      // guess which accounts exist) — so this is the one case we show the
      // reset link for. The separate "not verified yet" message doesn't need it.
      if (result.error === "Incorrect email or password.") {
        document.getElementById("forgotPasswordLine").style.display = "block";
      }
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
    showStatus("Something went wrong: " + err.message + ". Please try again.", "error");
    console.error(err);
  }
});

function handleGoogleCredentialResponse(response) {
  clearStatus();
  showStatus("Verifying your Google account...", "info");

  callBackend({ action: "googleAuth", idToken: response.credential })
    .then((result) => {
      if (!result.success) {
        showStatus(result.error, "error");
        return;
      }

      if (result.isNewUser) {
        showStatus(
          "We don't have an account for this Google email yet. Please sign up first.",
          "info"
        );
      } else {
        saveSessionAndGoToDashboard(result.clientId, result.fullName, result.email, "Welcome back, " + result.fullName + ". Redirecting...");
      }
    })
    .catch((err) => {
      showStatus("Something went wrong verifying your Google account: " + err.message, "error");
      console.error(err);
    });
}

window.addEventListener("load", function () {
  if (window.google && google.accounts) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });
    google.accounts.id.renderButton(document.getElementById("googleBtnWrap"), {
      theme: "outline",
      size: "large",
      width: 280,
      text: "signin_with"
    });
  }
});
