import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ============================================
// GLOBAL STATE
// ============================================

window.currentUser = null;
window.appState = {
  cases: [],
  activeCaseId: null,
  activeVersionId: null,
  currentInputs: {},
  lastRunInputs: {},
  hasUnsavedChanges: false,
  hasApiKey: false
};

// ============================================
// AUTH HANDLING
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
  } else {
    window.currentUser = user;
    console.log("Logged in:", user.email);
    
    // Initialize user in backend
    await initUser(user.uid, user.email, user.displayName);
    
    // Check API key status
    await checkApiKeyStatus();
    
    // Load cases
    await loadCases();
    
    updateStatusText(`Signed in: ${user.email}`);
  }
});

window.logout = async () => {
  await signOut(auth);
  window.location.href = "/login";
};

// ============================================
// USER INITIALIZATION
// ============================================

async function initUser(userId, email, displayName) {
  try {
    await fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, email, display_name: displayName })
    });
  } catch (e) {
    console.error("User init failed:", e);
  }
}

async function checkApiKeyStatus() {
  try {
    const res = await fetch("/api/user/api-key/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: window.currentUser.uid })
    });
    const data = await res.json();
    window.appState.hasApiKey = data.has_api_key;
    
    if (!data.has_api_key) {
      showApiKeyWarning();
    }
  } catch (e) {
    console.error("API key check failed:", e);
  }
}

function showApiKeyWarning() {
  const warning = document.createElement('div');
  warning.className = 'api-key-warning';
  warning.innerHTML = `
    <div class="warning-content">
      <span class="warning-icon">⚠️</span>
      <span>Gemini API key not configured. Please add your API key in Settings to run analyses.</span>
      <button class="btn-link" onclick="openSettings()">Configure Now</button>
    </div>
  `;
  document.querySelector('.setup-panel').prepend(warning);
}

// ============================================
// SETTINGS MODAL
// ============================================

window.openSettings = async () => {
  const modal = $('settingsModal');
  modal.style.display = 'flex';
  
  // Load current API key status
  try {
    const res = await fetch("/api/user/api-key/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: window.currentUser.uid })
    });
    const data = await res.json();
    
    if (data.has_api_key) {
      $('apiKeyStatus').innerHTML = `<span class="status-success">✓ API key configured (${data.api_key_preview})</span>`;
    } else {
      $('apiKeyStatus').innerHTML = '<span class="status-warning">No API key configured</span>';
    }
  } catch (e) {
    console.error("Failed to load API key status:", e);
  }
};

window.closeSettings = () => {
  $('settingsModal').style.display = 'none';
  $('geminiApiKey').value = '';
};

window.saveSettings = async () => {
  const apiKey = $('geminiApiKey').value.trim();
  
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }
  
  try {
    const res = await fetch('/api/user/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: window.currentUser.uid,
        api_key: apiKey
      })
    });
    
    if (!res.ok) throw new Error('Failed to save API key');
    
    window.appState.hasApiKey = true;
    
    // Remove warning if present
    const warning = document.querySelector('.api-key-warning');
    if (warning) warning.remove();
    
    closeSettings();
    alert('API key saved successfully!');
  } catch (e) {
    alert('Failed to save API key: ' + e.message);
  }
};

// Close modal when clicking outside
window.onclick = (event) => {
  const modal = $('settingsModal');
  if (event.target === modal) {
    closeSettings();
  }
};

// ============================================
// CASE MANAGEMENT
// ============================================

async function loadCases() {
  try {
    const res = await fetch("/api/cases/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: window.currentUser.uid })
    });
    const data = await res.json();
    window.appState.cases = data.cases;
    renderCasesSidebar();
    
    // Auto-select first case if available
    if (data.cases.length > 0 && !window.appState.activeCaseId) {
      await selectCase(data.cases[0].case_id);
    }
  } catch (e) {
    console.error("Load cases failed:", e);
  }
}

async function createNewCase() {
  const name = prompt("Enter case name:", "New Case");
  if (!name) return;
  
  try {
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: window.currentUser.uid,
        name: name,
        description: ""
      })
    });
    
    if (!res.ok) throw new Error("Failed to create case");
    
    const newCase = await res.json();
    window.appState.cases.unshift(newCase);
    renderCasesSidebar();
    await selectCase(newCase.case_id);
  } catch (e) {
    alert("Failed to create case: " + e.message);
  }
}

async function selectCase(caseId) {
  try {
    const res = await fetch("/api/cases/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: window.currentUser.uid,
        case_id: caseId
      })
    });
    if (!res.ok) throw new Error("Case not found");
    
    const data = await res.json();
    window.appState.activeCaseId = caseId;
    
    // Update sidebar
    renderCasesSidebar();
    
    // If there's a latest version, load it
    if (data.versions.length > 0) {
      await selectVersion(data.versions[0].version_id);
    } else {
      clearResults();
    }
  } catch (e) {
    console.error("Select case failed:", e);
  }
}

async function renameCase(caseId) {
  const currentCase = window.appState.cases.find(c => c.case_id === caseId);
  const newName = prompt("Rename case:", currentCase?.name || "");
  if (!newName || newName === currentCase?.name) return;
  
  try {
    await fetch("/api/cases/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: window.currentUser.uid,
        case_id: caseId,
        name: newName
      })
    });
    
    await loadCases();
  } catch (e) {
    alert("Rename failed: " + e.message);
  }
}

async function deleteCase(caseId) {
  if (!confirm("Delete this case and all its versions? This cannot be undone.")) return;
  
  try {
    await fetch("/api/cases/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: window.currentUser.uid,
        case_id: caseId
      })
    });
    
    window.appState.activeCaseId = null;
    window.appState.activeVersionId = null;
    await loadCases();
    clearResults();
  } catch (e) {
    alert("Delete failed: " + e.message);
  }
}

// ============================================
// VERSION MANAGEMENT
// ============================================

async function selectVersion(versionId) {
  try {
    const res = await fetch("/api/versions/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: window.currentUser.uid,
        version_id: versionId
      })
    });
    if (!res.ok) throw new Error("Version not found");
    
    const version = await res.json();
    window.appState.activeVersionId = versionId;
    
    // Populate inputs from version
    populateInputsFromVersion(version);
    
    // Render results
    renderResults(version.analysis_response);
    
    // Update sidebar to highlight this version
    renderCasesSidebar();
    
    // Mark as no changes since this is a saved version
    window.appState.lastRunInputs = captureCurrentInputs();
    window.appState.hasUnsavedChanges = false;
    updateAnalyzeButton();
    
  } catch (e) {
    console.error("Load version failed:", e);
  }
}

function populateInputsFromVersion(version) {
  const req = version.request_payload;
  
  $("oldApi").value = req.old_api || "";
  $("newApi").value = req.new_api || "";
  $("envVars").value = req.env || "{}";
  $("bodyTemplate").value = req.body_template || '{ "prompt": "{{question}}" }';
  $("responsePath").value = req.response_path || "choices[0].message.content";
  $("goal").value = req.goal || "";
  $("oldPrompt").value = req.old_prompt || "";
  $("newPrompt").value = req.new_prompt || "";
  $("numCases").value = req.n_cases || 3;
  $("questionsManual").value = (req.manual_questions || []).join("\n");
}

// ============================================
// UI RENDERING
// ============================================

function renderCasesSidebar() {
  const container = $("casesList");
  if (!container) return;
  
  if (window.appState.cases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No cases yet</p>
        <button class="btn primary" onclick="createNewCase()">+ Create First Case</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = window.appState.cases.map(c => {
    const isActive = c.case_id === window.appState.activeCaseId;
    return `
      <div class="case-item ${isActive ? 'active' : ''}" data-case-id="${c.case_id}">
        <div class="case-header" onclick="toggleCaseVersions('${c.case_id}')">
          <div class="case-name">${escapeHtml(c.name)}</div>
          <div class="case-meta">${c.version_count} version${c.version_count !== 1 ? 's' : ''}</div>
        </div>
        <div class="case-actions">
          <button class="btn-icon" onclick="renameCase('${c.case_id}')" title="Rename">✏️</button>
          <button class="btn-icon" onclick="deleteCase('${c.case_id}')" title="Delete">🗑️</button>
        </div>
        <div class="versions-list" id="versions-${c.case_id}" style="display:none"></div>
      </div>
    `;
  }).join("");
  
  // Load versions for active case
  if (window.appState.activeCaseId) {
    loadVersionsForCase(window.appState.activeCaseId);
  }
}

async function toggleCaseVersions(caseId) {
  await selectCase(caseId);
  const versionsEl = $(`versions-${caseId}`);
  if (versionsEl) {
    versionsEl.style.display = versionsEl.style.display === 'none' ? 'block' : 'none';
  }
}

async function loadVersionsForCase(caseId) {
  try {
    const res = await fetch("/api/versions/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: window.currentUser.uid,
        case_id: caseId
      })
    });
    const data = await res.json();
    
    const versionsEl = $(`versions-${caseId}`);
    if (!versionsEl) return;
    
    versionsEl.style.display = 'block';
    versionsEl.innerHTML = data.versions.map(v => {
      const isActive = v.version_id === window.appState.activeVersionId;
      const date = new Date(v.created_at).toLocaleDateString();
      return `
        <div class="version-item ${isActive ? 'active' : ''}" onclick="selectVersion('${v.version_id}')">
          <div class="version-header">
            <span class="version-number">v${v.version_number}</span>
            <span class="version-score score-${getScoreColor(v.cookedness_score)}">${v.cookedness_score}</span>
          </div>
          <div class="version-meta">${date} • ${v.verdict}</div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error("Load versions failed:", e);
  }
}

function getScoreColor(score) {
  if (score >= 70) return 'danger';
  if (score >= 40) return 'warning';
  return 'safe';
}

// ============================================
// INPUT CHANGE DETECTION
// ============================================

function captureCurrentInputs() {
  return {
    oldApi: $("oldApi").value,
    newApi: $("newApi").value,
    envVars: $("envVars").value,
    bodyTemplate: $("bodyTemplate").value,
    responsePath: $("responsePath").value,
    goal: $("goal").value,
    oldPrompt: $("oldPrompt").value,
    newPrompt: $("newPrompt").value,
    numCases: $("numCases").value,
    questionsManual: $("questionsManual").value
  };
}

function hasInputsChanged() {
  const current = captureCurrentInputs();
  const last = window.appState.lastRunInputs;
  
  return Object.keys(current).some(key => current[key] !== last[key]);
}

function setupInputChangeListeners() {
  const inputs = [
    "oldApi", "newApi", "envVars", "bodyTemplate", "responsePath",
    "goal", "oldPrompt", "newPrompt", "numCases", "questionsManual"
  ];
  
  inputs.forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("input", () => {
        window.appState.hasUnsavedChanges = hasInputsChanged();
        updateAnalyzeButton();
      });
    }
  });
}

function updateAnalyzeButton() {
  const btn = document.querySelector('.btn-analyze');
  if (!btn) return;
  
  if (!window.appState.hasApiKey) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.title = "Configure Gemini API key in Settings first";
  } else if (window.appState.hasUnsavedChanges) {
    btn.disabled = false;
    btn.classList.remove('disabled');
    btn.title = "";
  } else if (window.appState.activeVersionId) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.title = "Change any input to run a new version";
  }
}

// ============================================
// RUN ANALYSIS
// ============================================

async function runAnalysis() {
  if (!window.currentUser) {
    alert("Please sign in first");
    return;
  }
  
  if (!window.appState.hasApiKey) {
    alert("Please configure your Gemini API key in Settings first");
    openSettings();
    return;
  }
  
  const manualQs = $("questionsManual").value.trim();
  const mode = manualQs ? "manual" : "generate";

  const payload = {
    user_id: window.currentUser.uid,
    case_id: window.appState.activeCaseId || null,  // ✅ Explicitly handle null
    case_name: window.appState.activeCaseId ? undefined : ($("caseName")?.value || "Untitled Case"),  // ✅ Allow custom name
    mode: mode,
    old_api: $("oldApi").value.trim(),
    new_api: $("newApi").value.trim(),
    env: $("envVars").value || "{}",
    body_template: $("bodyTemplate").value || '{ "prompt": "{{question}}" }',
    response_path: $("responsePath").value || "choices[0].message.content",
    goal: $("goal").value || "",
    old_prompt: $("oldPrompt").value || "",
    new_prompt: $("newPrompt").value || "",
    n_cases: parseInt($("numCases").value) || 3,
    manual_questions: manualQs ? manualQs.split("\n").map(s => s.trim()).filter(Boolean) : []
  };

  // Validation
  if (mode === "generate" && !payload.body_template.includes("{{question}}")) {
    if (!confirm("Request Body Template doesn't contain {{question}}. Continue?")) {
      return;
    }
  }

  // Show loading state
  showTab({ currentTarget: document.querySelector('[data-tab="summary"]') });
  $("summaryCard").innerHTML = `<div class="loading">
    <div class="spinner"></div>
    <p>Running analysis...</p>
  </div>`;
  updateStatusText("Running");
  
  // Disable button with animation
  const btn = document.querySelector('.btn-analyze');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${txt}`);
    }

    const data = await res.json();
    
    // ✅ Validate response contains required fields
    if (!data.case_id || !data.version_id) {
      throw new Error("Invalid response: missing case_id or version_id");
    }
    
    // Update state
    window.appState.activeCaseId = data.case_id;
    window.appState.activeVersionId = data.version_id;
    window.appState.lastRunInputs = captureCurrentInputs();
    window.appState.hasUnsavedChanges = false;
    
    // Render results
    renderResults(data);
    updateStatusText(`Done • v${data.version_number}`);
    
    // Reload cases to update sidebar
    await loadCases();

  } catch (err) {
    console.error("Analysis error:", err);
    $("summaryCard").innerHTML = `<div class="error">
      <b>Error</b>
      <pre>${err.message}</pre>
    </div>`;
    updateStatusText("Error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
    updateAnalyzeButton();
  }
}

// ============================================
// RENDER RESULTS
// ============================================

function renderResults(data) {
  window.lastRun = data;
  renderSummary(data);
  renderDeterministic(data);
  renderSamples(data);
  renderInsights(data.insight);
  $("snapshot").textContent = JSON.stringify(data, null, 2);
  $("runId").innerText = `${data.case_name || 'Case'} • v${data.version_number || '?'}`;
}

function clearResults() {
  $("summaryCard").innerHTML = '<p class="muted">Run analysis to see results</p>';
  $("snapshot").textContent = "";
  $("runId").innerText = "No version selected";
  updateStatusText("Idle");
}

// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderSummary(data) {
  const cooked = data.cookedness || { cookedness_score: 0, severity: "Unknown" };
  const verdict = (data.analysis && data.analysis.verdict) || "Unknown";
  const summaryText = (data.analysis && data.analysis.summary) || "";
  const det = data.deterministic || { deterministic_score: 0, deterministic_flags: [] };

  const safetyFlags = det.deterministic_flags.filter(f =>
    ["SAFETY_COMPROMISE", "CONFIDENCE_INFLATION"].includes(f)
  );

  const safetyOverride =
    verdict === "Regression" &&
    safetyFlags.length > 0;

  $("summaryCard").innerHTML = `
    <div class="summary-display">
      <div class="score-big">
        <div class="score-value score-${getScoreColor(cooked.cookedness_score)}">
          ${cooked.cookedness_score}
        </div>
        <div class="score-label">Cookedness</div>
        <div class="score-sub">${cooked.severity}</div>
      </div>

      <div class="summary-text">
        <div class="verdict verdict-${verdict.toLowerCase()}">
          ${verdict}
        </div>

        ${
          safetyOverride
            ? `<div class="safety-override">
                🔒 <b>Safety Override Triggered</b>
                <div class="muted">
                  NEW output introduced safety-critical risks
                  (${safetyFlags.join(", ")}), so verdict was forced to
                  <b>Regression</b> even if quality improved.
                </div>
              </div>`
            : ""
        }

        <div class="summary">${summaryText}</div>

        <div class="meta-row">
          <span>Deterministic score: <b>${det.deterministic_score}</b></span>
        </div>
      </div>
    </div>
  `;
}


function renderDeterministic(data) {
  const det = data.deterministic || { deterministic_flags: [], deterministic_score: 0 };
  const risk = (data.analysis && data.analysis.risk_flags) || [];

  $("detFlags").innerHTML = `
    <b>Layer 2A — Deterministic Analysis</b><br>
    Score: <b>${det.deterministic_score}</b><br>
    <small>${det.deterministic_flags.join(", ") || "No structural regressions detected"}</small>
  `;

  $("llmFlags").innerHTML = `
    <b>Layer 2B — LLM Judge Risks</b><br>
    <small>${risk.join(", ") || "No semantic risks flagged"}</small>
  `;
}


function renderSamples(data) {
  const oldS = (data.old_api_results && data.old_api_results[0] && data.old_api_results[0].response) || "";
  const newS = (data.new_api_results && data.new_api_results[0] && data.new_api_results[0].response) || "";
  $("oldSample").textContent = oldS || "—";
  $("newSample").textContent = newS || "—";
}

function renderInsights(insight) {
  if (!insight) {
    $("insightSummary").innerText = "No insight returned.";
    $("insightReview").innerText = "";
    $("insightFindings").innerHTML = "";
    $("insightSuggestions").innerHTML = "";
    $("revisedPrompt").value = "";
    $("quickTests").innerHTML = "";
    $("metrics").innerHTML = "";
    return;
  }

  $("insightSummary").innerHTML = `<b>${insight.short_summary || "Summary"}</b>`;

  if (Array.isArray(insight.detailed_review)) {
    $("insightReview").innerHTML = insight.detailed_review.map(p => `<p>${p}</p>`).join("");
  } else {
    $("insightReview").innerText = insight.detailed_review || "";
  }

  $("insightFindings").innerHTML = (insight.findings || []).map(f => `<li>${f}</li>`).join("");

  const suggestions = (insight.suggestions || []);
  $("insightSuggestions").innerHTML = suggestions.map(s => {
    const snippet = (s.suggested_text && String(s.suggested_text).trim()) ? `<pre>${escapeHtml(String(s.suggested_text))}</pre>` : `<div class="small-muted">No text snippet</div>`;
    const severityClass = (s.severity || "medium").toLowerCase();
    return `<div class="suggestion ${severityClass}">
      <b>${(s.scope || "UNKNOWN").toUpperCase()} • ${s.severity || "medium"}</b>
      <p>${s.explanation || ""}</p>
      ${snippet}
    </div>`;
  }).join("");

  $("revisedPrompt").value = insight.revised_prompt || "";
  $("quickTests").innerHTML = (insight.quick_tests || []).map(t => `<li>${t}</li>`).join("");
  $("metrics").innerHTML = (insight.metrics_to_watch || []).map(m => `<li>${m}</li>`).join("");
}

// ============================================
// HELPERS
// ============================================

const $ = id => document.getElementById(id);

function showTab(evt) {
  const tabName = evt.currentTarget.dataset.tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  evt.currentTarget.classList.add("active");

  document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
  const pane = document.getElementById("tab-" + tabName);
  if (pane) pane.classList.add("active");
}

function updateStatusText(text) {
  const el = $("statusText");
  if (el) el.innerText = text;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function (m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}

// Expose functions to global scope
window.createNewCase = createNewCase;
window.selectCase = selectCase;
window.selectVersion = selectVersion;
window.renameCase = renameCase;
window.deleteCase = deleteCase;
window.toggleCaseVersions = toggleCaseVersions;
window.runAnalysis = runAnalysis;
window.showTab = showTab;

// ============================================
// INIT
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  setupInputChangeListeners();
  
  // Ensure first tab active
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const firstTab = document.querySelector('.tab-btn[data-tab="summary"]');
  if (firstTab) firstTab.classList.add("active");
  
  document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
  const firstPane = document.getElementById("tab-summary");
  if (firstPane) firstPane.classList.add("active");
});