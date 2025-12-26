// static/js/versions.js
// ============================================================================
// Version Management Module (HARDENED + VERBOSE)
// - fix: pass full version to renderResults so results.js can read evaluation.llm_judge
// ============================================================================

import { fetchVersion, fetchVersions } from "./api.js";
import { appState } from "./state.js";
import { renderCasesSidebar, updateAnalyzeButton } from "./ui.js";
import { renderResults, clearResults } from "./results.js";
import { captureCurrentInputs } from "./inputs.js";
import { loadComments } from "./collaboration.js";
import { $ } from "./utils.js";

console.log("[VERSIONS] module loaded");

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function log(...args) {
  console.log("[VERSIONS]", ...args);
}
function warn(...args) {
  console.warn("[VERSIONS]", ...args);
}
function error(...args) {
  console.error("[VERSIONS]", ...args);
}

// ============================================================================
// SELECT VERSION
// ============================================================================

export async function selectVersion(versionId) {
  log("selectVersion called:", versionId);

  if (!versionId) {
    warn("selectVersion called without versionId");
    return;
  }

  try {
    // Clear previous UI state before loading new version
    clearResults();

    // Fetch full version payload (authoritative)
    const version = await fetchVersion(versionId);

    if (!version) {
      warn("Fetched version is falsy", version);
      return;
    }

    if (!version.analysis_response && !version.evaluation) {
      // still allow rendering if backend stored analysis at top-level
      log("Fetched version does not have analysis_response nested - proceeding with raw version object");
    }

    // Update global state
    appState.activeVersionId = versionId;
    appState.activeCaseId = version.case_id || appState.activeCaseId;

    log("Active version updated:", {
      case: appState.activeCaseId,
      version: appState.activeVersionId
    });

    // Hydrate inputs from request payload
    populateInputsFromVersion(version);

    // 🔥 CRITICAL FIX: Render results using entire version object (not only analysis_response)
    // results.js will normalize (read evaluation.llm_judge, analysis_response, etc.)
    renderResults(version);

    // Load comments scoped to this version (implementation may examine appState.activeVersionId)
    await loadComments();

    // Re-render sidebar to reflect active version highlight
    renderCasesSidebar();

    // Reset change tracking
    appState.lastRunInputs = captureCurrentInputs();
    appState.hasUnsavedChanges = false;
    updateAnalyzeButton();

    log("Version selection complete");

  } catch (e) {
    error("selectVersion failed:", e);
  }
}

// ============================================================================
// INPUT HYDRATION (SAFE + VERBOSE)
// ============================================================================

function populateInputsFromVersion(version) {
  log("Populating inputs from version");

  const req = version.request_payload || version.inputs || {};

  const safeSet = (id, value, fallback = "") => {
    const el = $(id);
    if (!el) {
      warn("Input not found:", id);
      return;
    }
    el.value = value ?? fallback;
  };

  safeSet("oldApi", req.old_api || req.oldApi);
  safeSet("newApi", req.new_api || req.newApi);
  safeSet("envVars", req.env || req.envVars || "{}");
  safeSet("bodyTemplate", req.body_template || req.bodyTemplate || '{ "prompt": "{{question}}" }');
  safeSet("responsePath", req.response_path || req.responsePath || "choices[0].message.content");
  safeSet("goal", req.goal || "");
  safeSet("oldPrompt", req.old_prompt || req.oldPrompt || "");
  safeSet("newPrompt", req.new_prompt || req.newPrompt || "");
  safeSet("numCases", req.n_cases || req.nCases || 3);

  const qm = $("questionsManual");
  if (qm) {
    if (Array.isArray(req.manual_questions)) {
      qm.value = req.manual_questions.join("\n");
    } else if (Array.isArray(req.manualQuestions)) {
      qm.value = req.manualQuestions.join("\n");
    } else {
      qm.value = "";
    }
  }

  log("Inputs populated");
}

// ============================================================================
// LOAD VERSIONS FOR A CASE
// ============================================================================

export async function loadVersionsForCase(caseId) {
  log("Loading versions for case:", caseId);

  if (!caseId) {
    warn("loadVersionsForCase called without caseId");
    return;
  }

  try {
    const data = await fetchVersions(caseId);
    const versionsEl = $(`versions-${caseId}`);

    if (!versionsEl) {
      warn("Versions container not found for case:", caseId);
      return;
    }

    versionsEl.style.display = "block";
    versionsEl.innerHTML = "";

    if (!data.versions || data.versions.length === 0) {
      versionsEl.innerHTML = `<div class="muted small">No versions yet</div>`;
      return;
    }

    versionsEl.innerHTML = data.versions.map(v => {
      const isActive = v.version_id === appState.activeVersionId;
      const date = v.created_at ? new Date(v.created_at).toLocaleDateString() : "";
      // Deep dive indicator ONLY for UI hinting
      const isDeepDive = Boolean(v.is_deep_dive || v.analysis_response?.is_deep_dive);
      const deepDiveBadge = isDeepDive
        ? '<span class="badge badge-premium" style="font-size:0.65rem;margin-left:4px;">🔬</span>'
        : '';

      return `
        <div class="version-item ${isActive ? "active" : ""}"
             onclick="selectVersion('${v.version_id}')">
          <div class="version-header">
            <span class="version-number">
              v${v.version_number || "?"}${deepDiveBadge}
            </span>
            <span class="version-score score-${getScoreColor(v.cookedness_score)}">
              ${v.cookedness_score ?? 0}
            </span>
          </div>
          <div class="version-meta">
            ${date} • ${v.verdict || "Unknown"}
          </div>
        </div>
      `;
    }).join("");

    log("Versions rendered:", data.versions.length);

  } catch (e) {
    error("loadVersionsForCase failed:", e);
  }
}

// ============================================================================
// SCORE COLOR HELPER
// ============================================================================

function getScoreColor(score = 0) {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "safe";
}

// ============================================================================
// GLOBAL EXPORT FOR HTML
// ============================================================================

window.selectVersion = selectVersion;

log("versions.js fully initialized");
