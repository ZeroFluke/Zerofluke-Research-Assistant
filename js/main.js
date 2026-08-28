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

function applySessionNav() {
  const clientId = localStorage.getItem("zf_clientId");
  const fullName = localStorage.getItem("zf_fullName");
  if (!clientId) return;

  const firstName = (fullName || "Account").split(" ")[0];
  const loggedInLinksHtml = (mobile) =>
    `<a href="dashboard.html"${mobile ? ' data-nav="dashboard"' : ''}>${mobile ? "My Dashboard" : firstName + "'s Dashboard"}</a>` +
    `<a href="#" id="${mobile ? "logoutLinkMobile" : "logoutLinkDesktop"}"${mobile ? "" : ' class="nav-login"'}>Log out</a>`;

  const desktopSlot = document.getElementById("authLinksDesktop");
  const mobileSlot = document.getElementById("authLinksMobile");
  if (desktopSlot) desktopSlot.innerHTML = loggedInLinksHtml(false);
  if (mobileSlot) mobileSlot.innerHTML = loggedInLinksHtml(true);

  ["logoutLinkDesktop", "logoutLinkMobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("zf_clientId");
        localStorage.removeItem("zf_fullName");
        localStorage.removeItem("zf_email");
        window.location.href = "index.html";
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await includePartials();
  setActiveNav();
  wireMobileNav();
  setFooterYear();
  applySessionNav();
});
