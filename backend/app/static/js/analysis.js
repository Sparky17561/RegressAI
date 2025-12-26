// analysis.js - Analysis Execution Module (Updated for Premium)
import { runAnalysisAPI } from "./api.js";
import { appState } from "./state.js";
import { captureCurrentInputs } from "./inputs.js";
import { renderResults } from "./results.js";
import { loadCases } from "./cases.js";
import { updateStatusText, updateAnalyzeButton } from "./ui.js";
import { openSettings } from "./settings.js";
import { $, showTab } from "./utils.js";

// Check if user is premium
async function checkPremiumStatus() {
  try {
    const res = await fetch("/api/subscription/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: window.currentUser.uid })
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.is_premium;
    }
  } catch (err) {
    console.error("Premium check failed:", err);
  }
  return false;
}

export async function runAnalysis() {
  if (!window.currentUser) {
    alert("Please sign in first");
    return;
  }
  
  // Check if user is premium
  const isPremium = await checkPremiumStatus();
  
  // Premium users don't need API key
  if (!isPremium && !appState.hasApiKey) {
    alert("Please configure your Groq API key in Settings first");
    openSettings();
    return;
  }
  
  const manualQs = $("questionsManual")?.value?.trim() || "";
  const mode = manualQs ? "manual" : "generate";

  const payload = {
    user_id: window.currentUser.uid,
    case_id: appState.activeCaseId || null,
    case_name: appState.activeCaseId ? undefined : ($("caseName")?.value || "Untitled Case"),
    mode: mode,
    old_api: $("oldApi")?.value?.trim() || "",
    new_api: $("newApi")?.value?.trim() || "",
    env: $("envVars")?.value || "{}",
    body_template: $("bodyTemplate")?.value || '{ "prompt": "{{question}}" }',
    response_path: $("responsePath")?.value || "choices[0].message.content",
    goal: $("goal")?.value || "",
    old_prompt: $("oldPrompt")?.value || "",
    new_prompt: $("newPrompt")?.value || "",
    n_cases: parseInt($("numCases")?.value) || 3,
    manual_questions: manualQs ? manualQs.split("\n").map(s => s.trim()).filter(Boolean) : [],
    use_regressai_api: isPremium  // Flag for backend
  };

  // Validation
  if (mode === "generate" && !payload.body_template.includes("{{question}}")) {
    if (!confirm("Request Body Template doesn't contain {{question}}. Continue?")) {
      return;
    }
  }

  // Show loading state
  const summaryTab = document.querySelector('[data-tab="summary"]');
  if (summaryTab) {
    showTab({ currentTarget: summaryTab });
  }
  
  const summaryCard = $("summaryCard");
  if (summaryCard) {
    summaryCard.innerHTML = `<div class="loading">
      <div class="spinner"></div>
      <p>Running analysis...</p>
      ${isPremium ? '<p class="small">Using RegressAI API</p>' : ''}
    </div>`;
  }
  
  updateStatusText("Running");
  
  // Disable button with animation
  const btn = document.querySelector('.btn-analyze');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    const data = await runAnalysisAPI(payload);
    
    // Validate response contains required fields
    if (!data.case_id || !data.version_id) {
      throw new Error("Invalid response: missing case_id or version_id");
    }
    
    // Update state
    appState.activeCaseId = data.case_id;
    appState.activeVersionId = data.version_id;
    appState.lastRunInputs = captureCurrentInputs();
    appState.hasUnsavedChanges = false;
    
    // Render results
    renderResults(data);
    updateStatusText(`Done • v${data.version_number}`);
    
    // Reload cases to update sidebar
    await loadCases();

  } catch (err) {
    console.error("Analysis error:", err);
    if (summaryCard) {
      summaryCard.innerHTML = `<div class="error">
        <b>Error</b>
        <pre>${err.message}</pre>
      </div>`;
    }
    updateStatusText("Error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
    updateAnalyzeButton();
  }
}

// Expose to global scope
window.runAnalysis = runAnalysis;