// app.js — Main Entry Point

import { initAuth, logout } from "./auth.js";
import { initSettingsHandlers, openSettings } from "./settings.js";
import { setupInputChangeListeners } from "./inputs.js";
import { showTab } from "./utils.js";
import { runAnalysis } from "./analysis.js";
import { createNewCase } from "./cases.js";

// Import all modules to ensure they're loaded
import "./cases.js";
import "./versions.js";
import "./ui.js";
import "./collaboration.js";
import "./results.js";
import "./settings.js";

// Boot auth (this triggers everything else)
initAuth();
initSettingsHandlers();

document.addEventListener("DOMContentLoaded", () => {
  setupInputChangeListeners();
  setupEventListeners();
  setupDefaultTab();
});

function setupEventListeners() {
  // Main action buttons
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
    // ✅ REPLACE WITH THIS
      btnSettings.addEventListener("click", () => {
        window.openSettings();
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

function setupDefaultTab() {
  // Ensure first tab is active
  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.classList.remove("active")
  );

  const firstTab = document.querySelector('[data-tab="summary"]');
  if (firstTab) firstTab.classList.add("active");

  document.querySelectorAll(".pane").forEach(p =>
    p.classList.remove("active")
  );

  const firstPane = document.getElementById("tab-summary");
  if (firstPane) firstPane.classList.add("active");
}