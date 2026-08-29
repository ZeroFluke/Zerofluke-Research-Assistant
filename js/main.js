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
      '<button class="account-trigger" id="accountTrigger" aria-expanded="false">' +
      '<span id="accountFirstName">Account</span>' +
      '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<div class="account-dropdown" id="accountDropdown">' +
      '<a href="dashboard.html">Dashboard</a>' +
      '<a href="order.html">Place a New Order</a>' +
      '<a href="contact.html">Lodge a Complaint</a>' +
      '<a href="#" id="appLogoutLink">Log out</a>' +
      '</div>' +
      '</div>';
  }

  // Mobile panel is already an expandable menu, so a flat stacked list reads
  // better here than nesting another click-to-open dropdown inside it.
  const mobileSlot = document.getElementById("ctaAreaMobile");
  if (mobileSlot) {
    mobileSlot.innerHTML =
      '<a href="dashboard.html" data-nav="dashboard">Dashboard</a>' +
      '<a href="order.html">Place a New Order</a>' +
      '<a href="contact.html">Lodge a Complaint</a>' +
      '<a href="#" id="appLogoutLinkMobile">Log out</a>';

    const mobileLogout = document.getElementById("appLogoutLinkMobile");
    if (mobileLogout) {
      mobileLogout.addEventListener("click", (e) => {
        e.preventDefault();
        clearSessionAndRedirect();
      });
    }
  }
}

// Wires the simplified account-menu header used on dashboard.html / order.html.
// No-ops silently on pages that use the full public header instead.
function initAppHeader() {
  const menu = document.getElementById("accountMenu");
  const trigger = document.getElementById("accountTrigger");
  const nameEl = document.getElementById("accountFirstName");
  const logoutLink = document.getElementById("appLogoutLink");
  if (!menu || !trigger) return;

  const fullName = localStorage.getItem("zf_fullName");
  if (nameEl) nameEl.textContent = (fullName || "Account").split(" ")[0];

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.remove("open");
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

document.addEventListener("DOMContentLoaded", async () => {
  await includePartials();
  setActiveNav();
  wireMobileNav();
  wireNavDropdowns();
  setFooterYear();
  applySessionNav();
  initAppHeader();
});
