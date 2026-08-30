/* ZeroFluke Research Assistant — shared site behavior */

async function includePartials() {
  const slots = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(slots).map(async (slot) => {
      const path = slot.getAttribute("data-include");
      try {
        const res = await fetch(path);
        slot.innerHTML = await res.text();
      } catch (err) {
        console.error("Could not load partial:", path, err);
      }
    })
  );
}

function setActiveNav() {
  const page = document.body.getAttribute("data-page");
  if (!page) return;
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
    link.classList.add("active");
  });
}

function wireMobileNav() {
  const toggle = document.getElementById("navToggle");
  const panel = document.getElementById("mobilePanel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close the mobile panel after a link is tapped
  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      panel.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function clearSessionAndRedirect() {
  localStorage.removeItem("zf_clientId");
  localStorage.removeItem("zf_fullName");
  localStorage.removeItem("zf_email");
  window.location.href = "index.html";
}

const AVATAR_COLORS = ["#2E3FD1", "#B98A2E", "#3D8B6A", "#A24E9C", "#C0483A", "#2E7DB9", "#6C5CE0", "#0E7C6B"];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function applySessionNav() {
  const clientId = localStorage.getItem("zf_clientId");
  if (!clientId) return;

  // Desktop: swap Log in / Sign up / Place a Request for the same account
  // dropdown used on dashboard.html and order.html. Only present on pages
  // using the full public header — no-ops harmlessly otherwise.
  const desktopSlot = document.getElementById("ctaAreaDesktop");
  if (desktopSlot) {
    desktopSlot.innerHTML =
      '<div class="account-menu" id="accountMenu">' +
      '<button class="account-trigger" id="accountTrigger" aria-expanded="false" aria-label="Account menu"></button>' +
      '<div class="account-dropdown" id="accountDropdown">' +
      '<div class="account-dropdown-name" id="accountDropdownName"></div>' +
      '<a href="dashboard.html">Dashboard</a>' +
      '<a href="order.html">Place a New Order</a>' +
      '<a href="faq.html">FAQ</a>' +
      '<a href="contact.html">Lodge a Complaint</a>' +
      '<a href="#" id="appLogoutLink">Log out</a>' +
      '</div>' +
      '</div>';
  }

  // Mobile: clear the Log in / Sign up / Place a Request area entirely.
  // Account actions live in the separate avatar button instead (see
  // wireMobileAvatar), so the hamburger panel only ever holds site nav.
  const mobileSlot = document.getElementById("ctaAreaMobile");
  if (mobileSlot) mobileSlot.innerHTML = "";

  const fullName = localStorage.getItem("zf_fullName") || "";
  wireAvatar("mobileAvatarTrigger", "mobileAvatarDropdown", "mobileAvatarName", "mobileAvatarLogout", fullName, true);
  if (desktopSlot) {
    wireAvatar("accountTrigger", "accountDropdown", "accountDropdownName", "appLogoutLink", fullName, false);
  }
}

function wireAvatar(triggerId, dropdownId, nameId, logoutId, fullName, isMobileVariant) {
  const trigger = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  const nameEl = document.getElementById(nameId);
  const logoutLink = document.getElementById(logoutId);
  if (!trigger || !dropdown) return;

  const initial = (fullName.trim().charAt(0) || "?").toUpperCase();
  trigger.textContent = initial;
  trigger.style.background = colorForName(fullName || "?");
  if (isMobileVariant) trigger.classList.add("show");
  if (nameEl) nameEl.textContent = fullName;

  const menu = isMobileVariant ? dropdown : trigger.closest(".account-menu");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = (isMobileVariant ? dropdown : menu).classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (e) => {
    const container = isMobileVariant ? dropdown : menu;
    if (container && !container.contains(e.target) && e.target !== trigger) {
      container.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      clearSessionAndRedirect();
    });
  }
}

// Wires the simplified account-menu header used on dashboard.html / order.html
// when it's already present in the page's static HTML (not injected via
// applySessionNav). No-ops silently when accountMenu isn't on the page.
function initAppHeader() {
  const menu = document.getElementById("accountMenu");
  if (!menu || document.getElementById("ctaAreaDesktop")) return;

  const fullName = localStorage.getItem("zf_fullName") || "";
  wireAvatar("accountTrigger", "accountDropdown", "accountDropdownName", "appLogoutLink", fullName, false);
}

// Wires the public "Contact" nav dropdown (Support / FAQ). Click to open,
// click outside to close — same interaction as the account menu, so it
// behaves consistently on both touch and desktop.
function wireNavDropdowns() {
  document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
    const trigger = dropdown.querySelector(".nav-dropdown-trigger");
    if (!trigger) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".nav-dropdown.open").forEach((d) => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });
  });

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".nav-dropdown.open").forEach((d) => {
      if (!d.contains(e.target)) d.classList.remove("open");
    });
  });
}

function wireInfoIcons() {
  document.querySelectorAll(".info-icon").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = btn.classList.contains("open");
      document.querySelectorAll(".info-icon.open").forEach((el) => el.classList.remove("open"));
      if (!wasOpen) btn.classList.add("open");
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".info-icon.open").forEach((el) => el.classList.remove("open"));
  });
}

const EYE_ON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a20.3 20.3 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 7 11 7a20.3 20.3 0 01-3.22 4.19M14.12 14.12a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function wirePasswordToggles() {
  document.querySelectorAll(".password-wrap").forEach((wrap) => {
    const input = wrap.querySelector("input");
    const toggle = wrap.querySelector(".password-toggle");
    if (!input || !toggle) return;

    toggle.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggle.innerHTML = isHidden ? EYE_OFF_SVG : EYE_ON_SVG;
      toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await includePartials();
  setActiveNav();
  wireMobileNav();
  wireNavDropdowns();
  setFooterYear();
  applySessionNav();
  initAppHeader();
  wirePasswordToggles();
  wireInfoIcons();
});
