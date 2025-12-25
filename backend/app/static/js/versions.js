// versions.js - Version Management Module

import { fetchVersion, fetchVersions } from "./api.js";
import { appState } from "./state.js";
import { renderCasesSidebar, updateAnalyzeButton } from "./ui.js";
import { renderResults } from "./results.js";
import { captureCurrentInputs } from "./inputs.js";
import { loadComments } from "./collaboration.js";
import { $ } from "./utils.js";

// ============================================
// SELECT VERSION
// ============================================
export async function selectVersion(versionId) {
  try {
    const version = await fetchVersion(versionId);

    appState.activeVersionId = versionId;

    populateInputsFromVersion(version);
    renderResults(version.analysis_response);

    // ✅ ALWAYS load comments for selected version
    await loadComments();

    renderCasesSidebar();

    appState.lastRunInputs = captureCurrentInputs();
    appState.hasUnsavedChanges = false;
    updateAnalyzeButton();

  } catch (e) {
    console.error("Load version failed:", e);
  }
}

// ============================================
// POPULATE INPUTS (SAFE)
// ============================================
function populateInputsFromVersion(version) {
  const req = version.request_payload || {};

  const safeSet = (id, value) => {
    const el = $(id);
    if (el) el.value = value ?? "";
  };

  safeSet("oldApi", req.old_api);
  safeSet("newApi", req.new_api);
  safeSet("envVars", req.env || "{}");
  safeSet("bodyTemplate", req.body_template || '{ "prompt": "{{question}}" }');
  safeSet("responsePath", req.response_path || "choices[0].message.content");
  safeSet("goal", req.goal);
  safeSet("oldPrompt", req.old_prompt);
  safeSet("newPrompt", req.new_prompt);
  safeSet("numCases", req.n_cases || 3);

  const qm = $("questionsManual");
  if (qm && Array.isArray(req.manual_questions)) {
    qm.value = req.manual_questions.join("\n");
  }
}

// ============================================
// LOAD VERSIONS FOR CASE
// ============================================
export async function loadVersionsForCase(caseId) {
  try {
    const data = await fetchVersions(caseId);
    const versionsEl = $(`versions-${caseId}`);
    if (!versionsEl) return;

    versionsEl.style.display = "block";
    versionsEl.innerHTML = "";

    if (!data.versions || data.versions.length === 0) {
      versionsEl.innerHTML = `<div class="muted small">No versions yet</div>`;
      return;
    }

    versionsEl.innerHTML = data.versions.map(v => {
      const isActive = v.version_id === appState.activeVersionId;
      const date = new Date(v.created_at).toLocaleDateString();

      return `
        <div class="version-item ${isActive ? "active" : ""}"
             onclick="selectVersion('${v.version_id}')">
          <div class="version-header">
            <span class="version-number">v${v.version_number}</span>
            <span class="version-score score-${getScoreColor(v.cookedness_score)}">
              ${v.cookedness_score}
            </span>
          </div>
          <div class="version-meta">${date} • ${v.verdict}</div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("Load versions failed:", e);
  }
}

function getScoreColor(score = 0) {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "safe";
}

// ============================================
// GLOBAL (HTML onclick)
// ============================================
window.selectVersion = selectVersion;
