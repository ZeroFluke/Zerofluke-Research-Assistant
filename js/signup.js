const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";
const GOOGLE_CLIENT_ID = "305149507909-stpai58m35c6tmjjfr4cclgojjrau068.apps.googleusercontent.com";

// If someone's already logged in and lands on the signup page, send them
// straight to their dashboard instead of showing the signup form again.
document.addEventListener("DOMContentLoaded", function () {
  if (localStorage.getItem("zf_clientId")) {
    window.location.href = "dashboard.html";
  }
});

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

document.getElementById("signupForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  clearStatus();

  try {
    await handleSignupSubmit();
  } catch (err) {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
    showStatus("Something went wrong: " + err.message + ". Please try again.", "error");
    console.error(err);
  }
});

async function handleSignupSubmit() {

  const fullName = document.getElementById("su-name").value.trim();
  const email = document.getElementById("su-email").value.trim();
  const phone = document.getElementById("su-phone").value.trim();
  const password = document.getElementById("su-password").value;
  const passwordConfirm = document.getElementById("su-password-confirm").value;

  if (!/^\d{7,15}$/.test(phone)) {
    showStatus("Please enter a valid phone number.", "error");
    return;
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    if (!window.pendingGoogleSignup) {
      showStatus("Password must be at least 8 characters, with a letter and a number.", "error");
      return;
    }
  }

  if (!window.pendingGoogleSignup && password !== passwordConfirm) {
    showStatus("Passwords do not match.", "error");
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  const signupResult = await callBackend({
    action: "signup",
    fullName: fullName,
    email: email,
    phone: phone,
    password: password,
    signupMethod: window.pendingGoogleSignup ? "Google" : "Form"
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Create Account";

  if (signupResult.success) {
    if (window.pendingGoogleSignup) {
      localStorage.setItem("zf_clientId", signupResult.clientId);
      localStorage.setItem("zf_fullName", signupResult.fullName);
      localStorage.setItem("zf_email", signupResult.email);
      showStatus("Account created. Redirecting to your dashboard...", "success");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);
    } else {
      showStatus(signupResult.message, "success");
      document.getElementById("signupForm").reset();
    }
  } else {
    showStatus(signupResult.error, "error");
  }
}

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
          "Almost done, " + result.fullName + ". Please add a working phone number to finish signing up.",
          "info"
        );
        document.getElementById("su-name").value = result.fullName;
        document.getElementById("su-email").value = result.email;
        document.getElementById("su-name").readOnly = true;
        document.getElementById("su-email").readOnly = true;
        document.getElementById("su-password").closest(".field").style.display = "none";
        document.getElementById("su-password").required = false;
        document.getElementById("su-password-confirm").closest(".field").style.display = "none";
        document.getElementById("su-password-confirm").required = false;
        window.pendingGoogleSignup = true;
      } else {
        localStorage.setItem("zf_clientId", result.clientId);
        localStorage.setItem("zf_fullName", result.fullName);
        localStorage.setItem("zf_email", result.email);
        showStatus("Welcome back, " + result.fullName + ". Redirecting...", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1000);
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
      text: "signup_with"
    });
  }
});
