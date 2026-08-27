const BACKEND_URL = "https://script.google.com/macros/s/AKfycby9I_6Z9l52yG1_GPNvis8gUlmVxKYACNPn9Ai1R01WY3vnY8SXCyc_rqf05EUUF7qU8A/exec";
const GOOGLE_CLIENT_ID = "305149507909-stpai58m35c6tmjjfr4cclgojjrau068.apps.googleusercontent.com";

const TEMPLATE_KEYWORDS = [
  "FEDERAL REPUBLIC OF NIGERIA",
  "NATIONAL IDENTIFICATION NUMBER",
  "NATIONAL IDENTITY MANAGEMENT",
  "NIMC",
  "DIGITAL NIN SLIP"
];

let idCheckPassed = false;
let uploadedFileData = null;

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runOcrCheck(file, fullName, nin) {
  const ocrStatus = document.getElementById("ocrStatus");
  ocrStatus.textContent = "Checking your ID, this can take a few seconds...";

  const result = await Tesseract.recognize(file, "eng");
  const text = result.data.text.toUpperCase();
  const textDigitsOnly = text.replace(/\D/g, "");

  const ninDigitsOnly = nin.replace(/\D/g, "");
  const ninMatch = fuzzyDigitMatch(textDigitsOnly, ninDigitsOnly);

  const nameWords = fullName.toUpperCase().split(/\s+/).filter((w) => w.length >= 3);
  const nameMatch = nameWords.some((w) => text.includes(w));

  const templateFragments = ["NIGERIA", "IDENTIFICATION", "IDENTITY", "NIMC", "NIN"];
  const templateMatch = templateFragments.filter((f) => text.includes(f)).length >= 2;

  const signalsPassed = [ninMatch, nameMatch, templateMatch].filter(Boolean).length;
  idCheckPassed = signalsPassed >= 2;

  if (idCheckPassed) {
    ocrStatus.textContent = "ID looks good.";
  } else {
    ocrStatus.textContent = "We couldn't verify this ID. Make sure the name and NIN match what you entered, and the photo is clear and well lit.";
  }

  return idCheckPassed;
}

function fuzzyDigitMatch(haystack, needle) {
  if (haystack.includes(needle)) {
    return true;
  }
  if (needle.length < 8) {
    return false;
  }
  let bestMatchLength = 0;
  for (let start = 0; start <= needle.length - 6; start++) {
    for (let len = needle.length - start; len >= 6; len--) {
      const chunk = needle.substring(start, start + len);
      if (haystack.includes(chunk) && len > bestMatchLength) {
        bestMatchLength = len;
      }
    }
  }
  return bestMatchLength >= Math.floor(needle.length * 0.7);
}

document.getElementById("su-id-photo").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    document.getElementById("fileUploadName").textContent = file.name;
  }
});

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
  const nin = document.getElementById("su-nin").value.trim();
  const idFile = document.getElementById("su-id-photo").files[0];

  if (!/^\d{11}$/.test(nin)) {
    showStatus("NIN must be exactly 11 digits.", "error");
    return;
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    if (!window.pendingGoogleSignup) {
      showStatus("Password must be at least 8 characters, with a letter and a number.", "error");
      return;
    }
  }

  if (!idFile) {
    showStatus("Please upload your NIN photo.", "error");
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Checking ID...";

  const passed = await runOcrCheck(idFile, fullName, nin);

  if (!passed) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
    showStatus(
      "We couldn't verify your ID against what you entered. If you believe this is a mistake, please contact us.",
      "error"
    );
    return;
  }

  submitBtn.textContent = "Uploading ID...";

  const base64Data = await fileToBase64(idFile);
  const uploadResult = await callBackend({
    action: "uploadFile",
    fileName: idFile.name,
    mimeType: idFile.type,
    base64Data: base64Data,
    folderName: "ZeroFluke ID Verification"
  });

  if (!uploadResult.success) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
    showStatus("There was a problem uploading your ID. Please try again.", "error");
    return;
  }

  submitBtn.textContent = "Creating account...";

  const signupResult = await callBackend({
    action: "signup",
    fullName: fullName,
    email: email,
    phone: phone,
    password: password,
    nin: nin,
    idType: "NIN",
    idPhotoDriveLink: uploadResult.fileUrl,
    idCheckPassed: true,
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
          "Almost done, " + result.fullName + ". Please fill in your NIN and upload your ID below to finish signing up.",
          "info"
        );
        document.getElementById("su-name").value = result.fullName;
        document.getElementById("su-email").value = result.email;
        document.getElementById("su-name").readOnly = true;
        document.getElementById("su-email").readOnly = true;
        document.getElementById("su-password").closest(".field").style.display = "none";
        document.getElementById("su-password").required = false;
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
