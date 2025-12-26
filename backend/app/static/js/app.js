// static/js/app.js
// ============================================================================
// Application Entry Point (HARDENED + ORDERED)
// ============================================================================
//
// RESPONSIBILITIES
// ----------------
// - Boot authentication
// - Initialize settings
// - Wire UI events
// - Ensure correct lifecycle ordering
//
// IMPORTANT
// ---------
// - app.js does NOT render results
// - app.js does NOT control premium UI
// - app.js ensures modules load in correct order
//
// ============================================================================

import { initAuth, logout } from "./auth.js";
import { initSettingsHandlers } from "./settings.js";
import { setupInputChangeListeners } from "./inputs.js";
import { showTab } from "./utils.js";
import { runAnalysis } from "./analysis.js";
import { createNewCase } from "./cases.js";
import { checkSubscription } from "./premium.js";

// Force-load modules with side effects
import "./cases.js";
import "./versions.js";
import "./ui.js";
import "./collaboration.js";
import "./results.js";
import "./settings.js";
import "./premium.js";

console.log("[APP] module loaded");

// ============================================================================
// AUTH BOOTSTRAP
// ============================================================================

initAuth();
initSettingsHandlers();

// Auth-ready is the TRUE app start
window.addEventListener("auth-ready", async () => {
  console.log("[APP] auth-ready event received");

  if (!window.currentUser) {
    console.warn("[APP] auth-ready but no currentUser");
    return;
  }

  try {
    await checkSubscription();
    console.log("[APP] subscription check complete");
  } catch (e) {
    console.warn("[APP] subscription check failed:", e);
  }
});

// ============================================================================
// DOM READY
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("[APP] DOMContentLoaded");

  setupInputChangeListeners();
  setupEventListeners();
  setupDefaultTab();

  console.log("[APP] UI fully wired");
});

// ============================================================================
// EVENT WIRING
// ============================================================================

function setupEventListeners() {
  console.log("[APP] Wiring event listeners");

  const btnAnalyze = document.getElementById("btnAnalyze");
  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", runAnalysis);
  }

  const btnNewCase = document.getElementById("btnNewCase");
  if (btnNewCase) {
    btnNewCase.addEventListener("click", createNewCase);
  }

  const btnSettings = document.getElementById("btnSettings");
  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      window.openSettings?.();
    });
  }

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", showTab);
  });
}

// ============================================================================
// DEFAULT TAB SETUP
// ============================================================================

function setupDefaultTab() {
  console.log("[APP] Setting default tab");

  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.classList.remove("active")
  );

  const summaryBtn = document.querySelector('[data-tab="summary"]');
  if (summaryBtn) {
    summaryBtn.classList.add("active");
  }

  document.querySelectorAll(".pane").forEach(p =>
    p.classList.remove("active")
  );

  const summaryPane = document.getElementById("tab-summary");
  if (summaryPane) {
    summaryPane.classList.add("active");
  }
}

console.log("[APP] app.js fully initialized");
