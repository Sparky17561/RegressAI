// results.js - Render Analysis Results (Canonical Format)
import { $ } from "./utils.js";

export function renderResults(data) {
  console.log("Rendering results:", data);
  
  // Update run ID with version info
  const runIdEl = $("runId");
  if (runIdEl) {
    runIdEl.textContent = `${data.case_name} • v${data.version_number} • ${data.run_id}`;
  }
  
  // Render summary card
  renderSummary(data);
  
  // Render diff tab
  renderDiff(data);
  
  // Render insights tab
  renderInsights(data);
  
  // Render snapshot tab
  renderSnapshot(data);
}

function renderSummary(data) {
  const card = $("summaryCard");
  if (!card) return;
  
  const verdict = data.verdict || {};
  const scores = data.scores || {};
  const evaluation = data.evaluation || {};
  
  // Verdict styling
  const verdictClass = {
    "Regression": "verdict-bad",
    "Improved": "verdict-good",
    "Neutral": "verdict-neutral",
    "Unknown": "verdict-unknown"
  }[verdict.final] || "verdict-unknown";
  
  // Safety override badge
  const safetyOverride = evaluation.safety_override || {};
  const overrideBadge = safetyOverride.triggered 
    ? `<span class="badge badge-critical">SAFETY OVERRIDE</span>` 
    : "";
  
  // Ship recommendation badge
  const shipBadge = {
    "DO_NOT_SHIP": '<span class="badge badge-critical">DO NOT SHIP</span>',
    "REVIEW": '<span class="badge badge-warning">REVIEW REQUIRED</span>',
    "SAFE_TO_SHIP": '<span class="badge badge-success">SAFE TO SHIP</span>'
  }[verdict.ship_recommendation] || "";
  
  card.innerHTML = `
    <div class="summary-header">
      <div class="verdict ${verdictClass}">
        ${verdict.final}
      </div>
      <div class="badges">
        ${overrideBadge}
        ${shipBadge}
      </div>
    </div>
    
    <div class="summary-reason">
      <strong>Reason:</strong> ${verdict.reason || "No reason provided"}
    </div>
    
    ${safetyOverride.triggered ? `
      <div class="safety-override-panel">
        <h4>🔴 Safety Override Triggered</h4>
        <p><strong>Root Cause:</strong> ${safetyOverride.primary_root_cause}</p>
        <p><strong>Escalation:</strong> ${safetyOverride.escalation_reason}</p>
        <p><strong>Action:</strong> Overrode LLM verdict to "${safetyOverride.overridden_verdict}"</p>
      </div>
    ` : ""}
    
    <div class="scores-grid">
      <div class="score-card">
        <div class="score-label">Cookedness</div>
        <div class="score-value ${getCookenessClass(scores.cookedness?.score)}">
          ${scores.cookedness?.score || 0}
        </div>
        <div class="score-sublabel">${scores.cookedness?.severity || "Unknown"}</div>
      </div>
      
      <div class="score-card">
        <div class="score-label">Quality Impact</div>
        <div class="score-value">
          ${scores.quality_score || 0}
        </div>
        <div class="score-sublabel">Helpfulness/Structure</div>
      </div>
      
      <div class="score-card">
        <div class="score-label">Safety Score</div>
        <div class="score-value ${getSafetyClass(scores.safety_score)}">
          ${scores.safety_score || 0}
        </div>
        <div class="score-sublabel">Risk Assessment</div>
      </div>
      
      <div class="score-card">
        <div class="score-label">Deterministic</div>
        <div class="score-value">
          ${scores.deterministic_score || 0}
        </div>
        <div class="score-sublabel">Rule-based Detection</div>
      </div>
    </div>
    
    <div class="evaluation-layers">
      <h4>Evaluation Layers</h4>
      
      <div class="layer">
        <div class="layer-header">
          <span class="layer-icon">🟨</span>
          <strong>2A - Deterministic (Rule Engine)</strong>
        </div>
        <div class="layer-body">
          <p><strong>Score:</strong> ${evaluation.deterministic?.score || 0}/100</p>
          <p><strong>Flags:</strong> ${(evaluation.deterministic?.flags || []).join(", ") || "None"}</p>
        </div>
      </div>
      
      <div class="layer">
        <div class="layer-header">
          <span class="layer-icon">🟨</span>
          <strong>2B - LLM Judge (Advisory)</strong>
        </div>
        <div class="layer-body">
          <p><strong>Model:</strong> ${evaluation.llm_judge?.model || "Unknown"}</p>
          <p><strong>Verdict:</strong> ${evaluation.llm_judge?.verdict || "Unknown"}</p>
          <p><strong>Confidence:</strong> ${evaluation.llm_judge?.confidence || "medium"}</p>
          <p><strong>Summary:</strong> ${evaluation.llm_judge?.summary || "No summary"}</p>
        </div>
      </div>
      
      ${safetyOverride.triggered ? `
        <div class="layer layer-critical">
          <div class="layer-header">
            <span class="layer-icon">🟥</span>
            <strong>2C - Safety Override (Authoritative)</strong>
          </div>
          <div class="layer-body">
            <p><strong>Status:</strong> TRIGGERED</p>
            <p><strong>Root Cause:</strong> ${safetyOverride.primary_root_cause}</p>
            <p><strong>Final Verdict:</strong> ${safetyOverride.overridden_verdict}</p>
          </div>
        </div>
      ` : `
        <div class="layer">
          <div class="layer-header">
            <span class="layer-icon">✅</span>
            <strong>2C - Safety Override (Authoritative)</strong>
          </div>
          <div class="layer-body">
            <p><strong>Status:</strong> Not triggered</p>
            <p>No critical safety issues detected</p>
          </div>
        </div>
      `}
    </div>
    
    <div class="tradeoff-section">
      <h4>Tradeoff Analysis</h4>
      <p>This explains why regression can happen even when safety improved:</p>
      <ul>
        <li><strong>Helpfulness Delta:</strong> ${data.tradeoff?.helpfulness_delta || 0}</li>
        <li><strong>Safety Delta:</strong> ${data.tradeoff?.safety_delta || 0}</li>
        <li><strong>Net Effect:</strong> ${data.tradeoff?.net_effect || "unknown"}</li>
      </ul>
    </div>
  `;
}

function renderDiff(data) {
  const oldSampleEl = $("oldSample");
  const newSampleEl = $("newSample");
  
  if (oldSampleEl && newSampleEl) {
    const results = data.results || {};
    const oldResults = results.old || [];
    const newResults = results.new || [];
    
    if (oldResults.length > 0 && newResults.length > 0) {
      oldSampleEl.textContent = JSON.stringify(oldResults[0], null, 2);
      newSampleEl.textContent = JSON.stringify(newResults[0], null, 2);
    }
  }
}

function renderInsights(data) {
  const insight = data.insight || {};
  
  // Summary
  const summaryEl = $("insightSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="insight-card">
        <h4>Change Type: ${insight.change_type || "Unknown"}</h4>
        <p><strong>Summary:</strong> ${insight.short_summary || "No summary available"}</p>
      </div>
    `;
  }
  
  // Detailed review
  const reviewEl = $("insightReview");
  if (reviewEl) {
    reviewEl.innerHTML = `
      <div class="insight-card">
        <p>${insight.detailed_review || "No detailed review available"}</p>
      </div>
    `;
  }
  
  // Findings
  const findingsEl = $("insightFindings");
  if (findingsEl) {
    const findings = insight.findings || [];
    findingsEl.innerHTML = findings.length 
      ? findings.map(f => `<li>${f}</li>`).join("")
      : "<li class='muted'>No findings</li>";
  }
  
  // Suggestions
  const suggestionsEl = $("insightSuggestions");
  if (suggestionsEl) {
    const suggestions = insight.suggestions || [];
    if (suggestions.length === 0) {
      suggestionsEl.innerHTML = "<p class='muted'>No suggestions</p>";
    } else {
      suggestionsEl.innerHTML = suggestions.map(s => {
        const severityClass = {
          "critical": "badge-critical",
          "high": "badge-warning",
          "medium": "badge-info",
          "low": "badge-success"
        }[s.severity] || "badge-info";
        
        return `
          <div class="suggestion-card">
            <div class="suggestion-header">
              <span class="badge ${severityClass}">${s.severity}</span>
              <span class="badge">${s.scope}</span>
              <span class="badge">${s.change_type}</span>
            </div>
            <div class="suggestion-body">
              ${s.suggested_text ? `<pre>${s.suggested_text}</pre>` : ""}
              <p><strong>Why:</strong> ${s.explanation}</p>
            </div>
          </div>
        `;
      }).join("");
    }
  }
  
  // Revised prompt
  const revisedPromptEl = $("revisedPrompt");
  if (revisedPromptEl) {
    revisedPromptEl.value = insight.revised_prompt || "No revised prompt available";
  }
  
  // Quick tests
  const quickTestsEl = $("quickTests");
  if (quickTestsEl) {
    const tests = insight.quick_tests || [];
    quickTestsEl.innerHTML = tests.length
      ? tests.map(t => `<li>${t}</li>`).join("")
      : "<li class='muted'>No quick tests</li>";
  }
  
  // Metrics
  const metricsEl = $("metrics");
  if (metricsEl) {
    const metrics = insight.metrics_to_watch || [];
    metricsEl.innerHTML = metrics.length
      ? metrics.map(m => `<li>${m}</li>`).join("")
      : "<li class='muted'>No metrics</li>";
  }
}

function renderSnapshot(data) {
  const snapshotEl = $("snapshot");
  if (snapshotEl) {
    snapshotEl.textContent = JSON.stringify(data, null, 2);
  }
}

// Helper functions
function getCookenessClass(score) {
  if (score >= 80) return "score-critical";
  if (score >= 60) return "score-warning";
  if (score >= 40) return "score-caution";
  return "score-safe";
}

function getSafetyClass(score) {
  if (score >= 80) return "score-safe";
  if (score >= 60) return "score-caution";
  if (score >= 40) return "score-warning";
  return "score-critical";
}

export function clearResults() {
  const idsToClear = [
    "runId",
    "summaryCard",
    "oldSample",
    "newSample",
    "insightSummary",
    "insightReview",
    "insightFindings",
    "insightSuggestions",
    "revisedPrompt",
    "quickTests",
    "metrics",
    "snapshot"
  ];

  idsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.value = "";
    } else {
      el.innerHTML = "";
    }
  });
}
