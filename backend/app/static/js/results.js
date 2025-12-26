// static/js/results.js
// ============================================================================
// Results Rendering Module (AUTHORITATIVE FOR VISUALIZATIONS)
// - Normalizes different backend shapes (version or analysis_response)
// - Reads evaluation.llm_judge AND analysis_response fields
// - Responsible for rendering Insights + Visualizations
// ============================================================================

/* eslint-disable no-console */
import { $ } from "./utils.js";

console.log("[RESULTS] module loaded");

// ============================================================================
// INTERNAL STATE (VERSION-SCOPED)
// ============================================================================

let lastRenderedVersionId = null;
let lastWasDeepDive = false;

// Track rendered charts to safely destroy on version switch
const activeCharts = new Map();

// ============================================================================
// LOGGING HELPERS
// ============================================================================

function log(...args) {
  console.log("[RESULTS]", ...args);
}
function warn(...args) {
  console.warn("[RESULTS]", ...args);
}
function error(...args) {
  console.error("[RESULTS]", ...args);
}

// ============================================================================
// UTILS
// ============================================================================

function waitForVisible(el, cb) {
  if (!el) {
    cb(); // nothing to wait for
    return;
  }

  const isReady = () => el.offsetWidth > 0 && el.offsetHeight > 0;

  if (isReady()) {
    cb();
    return;
  }

  const ro = new ResizeObserver(() => {
    if (isReady()) {
      ro.disconnect();
      cb();
    }
  });

  ro.observe(el);
}

// Normalize incoming payloads. Accepts either:
// - full version object (version.analysis_response + version.evaluation)
// - or the analysis_response object directly
function normalizeVersionPayload(raw) {
  // raw may be:
  // { analysis_response: {...}, evaluation: {...}, version_id, version_number, ... }
  // or directly an analysis_response object
  const asVersion = raw && raw.analysis_response ? raw : null;
  const analysis = asVersion ? (raw.analysis_response || {}) : (raw || {});
  const evaluation = (raw && raw.evaluation) || analysis.evaluation || {};

  // Gather llm_judge from evaluation (preferred)
  const llmJudge = evaluation.llm_judge || analysis.llm_judge || {};

  // Derive simple fields
  const version_id = raw?.version_id || analysis?.version_id || llmJudge?.version_id || null;
  const version_number = raw?.version_number || analysis?.version_number || null;
  const run_id = raw?.run_id || analysis?.run_id || null;
  const case_name = raw?.case_name || analysis?.case_name || null;

  const is_deep_dive = Boolean(
    analysis.is_deep_dive ||
    analysis.deep_dive_metrics ||
    raw?.is_deep_dive
  );

  const visualization_data = analysis.visualization_data || analysis.viz || null;
  const deep_dive_metrics = analysis.deep_dive_metrics || analysis.deepMetrics || null;

  return {
    version_id,
    version_number,
    run_id,
    case_name,
    is_deep_dive,
    visualization_data,
    deep_dive_metrics,
    llmJudge,
    rawAnalysis: analysis,
    rawVersion: raw
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function renderResults(payload) {
  log("renderResults called");

  if (!payload) {
    warn("renderResults called with falsy payload");
    clearResults();
    return;
  }

  const normalized = normalizeVersionPayload(payload);

  log("Normalized payload:", {
    version_id: normalized.version_id,
    version_number: normalized.version_number,
    is_deep_dive: normalized.is_deep_dive
  });

  // Detect version change
  if (lastRenderedVersionId && lastRenderedVersionId !== normalized.version_id) {
    log("Version changed — clearing previous visualizations");
    destroyAllCharts();
    hideVisualizationTab();
  }

  lastRenderedVersionId = normalized.version_id;
  lastWasDeepDive = normalized.is_deep_dive;

  // Render core sections
  renderRunHeader(normalized);
  renderSummary(normalized);
  renderDiff(normalized);
  renderInsights(normalized);
  renderSnapshot(normalized);

  // Visualization authoritative decision
  if (normalized.is_deep_dive && normalized.visualization_data && normalized.deep_dive_metrics) {
    log("Deep dive detected — enabling visualizations");
    showVisualizationTab();

    const pane = document.getElementById("tab-visualizations");
    // ensure pane is visible and laid out before rendering charts
    waitForVisible(pane, () => {
      log("Visualization pane ACTIVE and laid out — rendering charts");
      // destroy any previous charts first
      destroyAllCharts();
      renderVisualizations(normalized.visualization_data, normalized.deep_dive_metrics);
    });
  } else {
    log("Not a deep dive or missing viz data — hiding visualizations");
    destroyAllCharts();
    hideVisualizationTab();
  }
}

// ============================================================================
// VISUALIZATION VISIBILITY (AUTHORITATIVE)
// ============================================================================

function showVisualizationTab() {
  const tabBtn = document.querySelector('[data-tab="visualizations"]');
  const pane = document.getElementById("tab-visualizations");

  if (tabBtn) {
    tabBtn.style.display = "inline-flex";
    tabBtn.classList.remove("disabled");
  }

  if (pane) {
    pane.style.display = "block";
    // optionally activate tab if none active
    const active = document.querySelector(".tab-btn.active");
    if (!active && tabBtn) {
      tabBtn.classList.add("active");
      pane.classList.add("active");
    }
  }

  log("Visualization tab shown");
}

function hideVisualizationTab() {
  const tabBtn = document.querySelector('[data-tab="visualizations"]');
  const pane = document.getElementById("tab-visualizations");

  if (tabBtn) {
    tabBtn.style.display = "none";
    tabBtn.classList.remove("active");
  }

  if (pane) {
    pane.style.display = "none";
    pane.classList.remove("active");
  }

  log("Visualization tab hidden");
}

// ============================================================================
// CHART LIFECYCLE
// ============================================================================

function destroyAllCharts() {
  log("Destroying all active charts");

  activeCharts.forEach((chart, key) => {
    try {
      // Chart.js returns object with destroy()
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    } catch (e) {
      warn("Failed to destroy chart:", key, e);
    }
  });

  activeCharts.clear();
}

// ============================================================================
// VISUALIZATION RENDERING
// ============================================================================

export function renderVisualizations(vizData, deepMetrics) {
  // Backwards-compatible alias (external callers might call this)
  return renderVisualizationsInternal(vizData, deepMetrics);
}

function renderVisualizationsInternal(vizData, deepMetrics) {
  log("renderVisualizations called");

  if (!vizData) {
    warn("renderVisualizations called without vizData");
    return;
  }

  // clear any previous charts
  destroyAllCharts();

  renderRadarChart(vizData);
  renderQualityChart(vizData);
  renderPerformanceChart(vizData);
  renderHallucinationChart(vizData);
  renderDeepMetrics(deepMetrics);
}

// ============================================================================
// INDIVIDUAL CHARTS (Chart.js assumed to be loaded globally)
// ============================================================================

function safeGetCanvas(id) {
  const el = document.getElementById(id);
  if (!el) {
    warn("Canvas not found:", id);
  }
  return el;
}

function renderRadarChart(vizData) {
  const canvas = safeGetCanvas("radarChart");
  if (!canvas || !vizData?.metrics_comparison) return;

  const cfg = {
    type: "radar",
    data: {
      labels: vizData.metrics_comparison.labels || [],
      datasets: [
        {
          label: "Old Model",
          data: vizData.metrics_comparison.old_scores || [],
          borderColor: "rgba(255,99,132,1)",
          backgroundColor: "rgba(255,99,132,0.15)"
        },
        {
          label: "New Model",
          data: vizData.metrics_comparison.new_scores || [],
          borderColor: "rgba(54,162,235,1)",
          backgroundColor: "rgba(54,162,235,0.15)"
        }
      ]
    },
    options: {
      scales: {
        r: { min: 0, max: 100 }
      },
      maintainAspectRatio: false
    }
  };

  try {
    const chart = new Chart(canvas, cfg);
    activeCharts.set("radar", chart);
  } catch (e) {
    warn("Failed to create radar chart:", e);
  }
}

function renderQualityChart(vizData) {
  const canvas = safeGetCanvas("qualityChart");
  if (!canvas || !vizData?.quality_distribution) return;

  const d = vizData.quality_distribution || {};
  const cfg = {
    type: "bar",
    data: {
      labels: ["Excellent", "Good", "Acceptable", "Poor", "Failed"],
      datasets: [
        {
          label: "Responses",
          data: [
            d.excellent || 0,
            d.good || 0,
            d.acceptable || 0,
            d.poor || 0,
            d.failed || 0
          ]
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  };

  try {
    const chart = new Chart(canvas, cfg);
    activeCharts.set("quality", chart);
  } catch (e) {
    warn("Failed to create quality chart:", e);
  }
}

function renderPerformanceChart(vizData) {
  const canvas = safeGetCanvas("performanceChart");
  if (!canvas || !Array.isArray(vizData?.test_case_performance)) return;

  const cases = vizData.test_case_performance || [];
  const labels = cases.map((c, i) => c.case_number ? `Case ${c.case_number}` : `Case ${i + 1}`);

  const cfg = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Old Quality",
          data: cases.map(c => c.old_quality || 0),
          borderColor: "rgba(255,99,132,1)",
          fill: false
        },
        {
          label: "New Quality",
          data: cases.map(c => c.new_quality || 0),
          borderColor: "rgba(54,162,235,1)",
          fill: false
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: "Quality Score" } }
      }
    }
  };

  try {
    const chart = new Chart(canvas, cfg);
    activeCharts.set("performance", chart);
  } catch (e) {
    warn("Failed to create performance chart:", e);
  }
}

function renderHallucinationChart(vizData) {
  const canvas = safeGetCanvas("hallucinationChart");
  if (!canvas || !vizData?.hallucination_data) return;

  const h = vizData.hallucination_data || {};
  const cfg = {
    type: "doughnut",
    data: {
      labels: ["Old Model Hallucination (%)", "New Model Hallucination (%)"],
      datasets: [
        {
          data: [
            (h.old_rate || 0) * 100,
            (h.new_rate || 0) * 100
          ]
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } }
    }
  };

  try {
    const chart = new Chart(canvas, cfg);
    activeCharts.set("hallucination", chart);
  } catch (e) {
    warn("Failed to create hallucination chart:", e);
  }
}

// ============================================================================
// DEEP METRICS RENDERING
// ============================================================================

function renderDeepMetrics(metrics) {
  const el = $("deepMetrics");
  if (!el) return;

  if (!metrics || Object.keys(metrics).length === 0) {
    el.innerHTML = `<div class="muted small">No advanced metrics available</div>`;
    return;
  }

  // Build a compact metrics grid
  el.innerHTML = `
    <div class="metrics-grid-compact">
      <div class="metric-card">
        <h4>🎯 Adversarial Robustness</h4>
        <div class="metric-score">${metrics.adversarial_robustness?.score ?? "N/A"}/100</div>
        <p class="small">Failed Cases: ${metrics.adversarial_robustness?.failed_cases?.length ?? 0}</p>
      </div>

      <div class="metric-card">
        <h4>📋 Instruction Adherence</h4>
        <div class="metric-score">${metrics.instruction_adherence?.score ?? "N/A"}/100</div>
        <p class="small">Drift: ${((metrics.instruction_adherence?.drift_rate || 0) * 100).toFixed(1)}%</p>
      </div>

      <div class="metric-card">
        <h4>🔄 Consistency</h4>
        <div class="metric-score">${metrics.consistency_score ?? "N/A"}/100</div>
      </div>

      <div class="metric-card">
        <h4>🚨 Hallucination Rate</h4>
        <div class="metric-score">${((metrics.hallucination_rate || 0) * 100).toFixed(1)}%</div>
      </div>

      <div class="metric-card">
        <h4>🛡️ Safety</h4>
        <div class="metric-score">${metrics.safety_breakdown?.safety_score ?? "N/A"}/100</div>
        <p class="small">Appropriate Refusals: ${metrics.safety_breakdown?.refused_appropriately ?? 0}</p>
      </div>

      <div class="metric-card">
        <h4>⚡ Token Efficiency</h4>
        <div class="metric-value">${(metrics.token_efficiency?.efficiency_delta || 0) > 0 ? '↑' : '↓'} ${Math.abs(metrics.token_efficiency?.efficiency_delta || 0).toFixed(1)}%</div>
        <p class="small">Avg: ${metrics.token_efficiency?.avg_tokens_new ?? "N/A"} tokens</p>
      </div>
    </div>
  `;
}

// ============================================================================
// CORE SECTIONS (INSIGHTS + SUMMARY + DIFF + SNAPSHOT)
// ============================================================================

function renderRunHeader(normalized) {
  const runIdEl = $("runId");
  if (!runIdEl) return;

  const badge = normalized.is_deep_dive
    ? `<span class="badge badge-premium">🔬 DEEP DIVE</span>`
    : "";

  runIdEl.innerHTML = `
    ${escapeHtml(normalized.case_name || "Unknown Case")} • v${normalized.version_number || "?"} • ${escapeHtml(normalized.run_id || normalized.version_id || "run") } ${badge}
  `;
}

function renderSummary(normalized) {
  const card = $("summaryCard");
  if (!card) return;

  // Prefer llmJudge summary if present
  const summary = normalized.llmJudge?.summary || normalized.rawAnalysis?.summary || normalized.rawVersion?.verdict || {};
  card.innerHTML = `<pre>${escapeHtml(typeof summary === "string" ? summary : JSON.stringify(summary, null, 2))}</pre>`;
}

function renderDiff(normalized) {
  const oldEl = $("oldSample");
  const newEl = $("newSample");
  if (!oldEl || !newEl) return;

  const r = normalized.rawAnalysis?.results || normalized.rawVersion?.results || {};
  oldEl.textContent = JSON.stringify(r.old?.[0] || {}, null, 2);
  newEl.textContent = JSON.stringify(r.new?.[0] || {}, null, 2);
}

function renderSnapshot(normalized) {
  const el = $("snapshot");
  if (!el) return;
  const snapshotData = normalized.rawVersion || normalized.rawAnalysis || {};
  el.textContent = JSON.stringify(snapshotData, null, 2);
}

function renderInsights(normalized) {
  const panel = $("insightSummary");
  const findingsList = $("insightFindings");
  const suggestionsEl = $("insightSuggestions");
  const revisedPromptEl = $("revisedPrompt");
  const quickTestsEl = $("quickTests");
  const metricsList = $("metrics");

  // 🔥 AUTHORITATIVE SOURCE
  const judge =
    normalized.rawVersion?.evaluation?.llm_judge ||
    normalized.rawAnalysis?.evaluation?.llm_judge ||
    normalized.llmJudge;

  if (!judge || Object.keys(judge).length === 0) {
    console.warn("[INSIGHTS] No llm_judge data found", normalized);
    if (panel) {
      panel.innerHTML = `<div class="card error">No evaluation data available</div>`;
    }
    return;
  }

  // -------------------------
  // CHANGE TYPE + SUMMARY
  // -------------------------
  if (panel) {
    panel.innerHTML = `
      <div class="card">
        <h3>Change Type: ${judge.change_type || "Unknown"}</h3>
        <p>${judge.summary || "No summary available"}</p>
      </div>
    `;
  }

  // -------------------------
  // FINDINGS
  // -------------------------
  if (findingsList) {
    if (judge.findings?.length) {
      findingsList.innerHTML = judge.findings
        .map(f => `<li>${f}</li>`)
        .join("");
    } else {
      findingsList.innerHTML = `<li class="muted">No findings</li>`;
    }
  }

  // -------------------------
  // SUGGESTIONS
  // -------------------------
  if (suggestionsEl) {
    if (judge.suggestions?.length) {
      suggestionsEl.innerHTML = judge.suggestions.map(s => `
        <div class="card suggestion">
          <strong>${s.scope} • ${s.severity}</strong>
          <p>${s.explanation || ""}</p>
          <pre>${s.suggested_text || ""}</pre>
        </div>
      `).join("");
    } else {
      suggestionsEl.innerHTML = `<div class="muted">No suggestions</div>`;
    }
  }

  // -------------------------
  // REVISED PROMPT
  // -------------------------
  if (revisedPromptEl) {
    revisedPromptEl.value =
      judge.revised_prompt || "No revised prompt available";
  }

  // -------------------------
  // QUICK TESTS
  // -------------------------
  if (quickTestsEl) {
    quickTestsEl.innerHTML = judge.quick_tests?.length
      ? judge.quick_tests.map(t => `<li>${t}</li>`).join("")
      : `<li class="muted">No quick tests</li>`;
  }

  // -------------------------
  // METRICS TO WATCH
  // -------------------------
  if (metricsList) {
    metricsList.innerHTML = judge.metrics_to_watch?.length
      ? judge.metrics_to_watch.map(m => `<li>${m}</li>`).join("")
      : `<li class="muted">No metrics</li>`;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s.replace(/[&<>"'`=\/]/g, function (s) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#x60;',
      '/': '&#x2F;',
      '=': '&#x3D;'
    })[s];
  });
}

// ============================================================================
// CLEAR RESULTS (CALLED ON VERSION SWITCH)
// ============================================================================

export function clearResults() {
  log("clearResults called");

  destroyAllCharts();
  hideVisualizationTab();

  [
    "summaryCard",
    "oldSample",
    "newSample",
    "insightSummary",
    "snapshot",
    "deepMetrics",
    "insightFindings",
    "insightSuggestions",
    "revisedPrompt",
    "quickTests",
    "metrics"
  ].forEach(id => {
    const el = $(id);
    if (el) {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") el.value = "";
      else el.innerHTML = "";
    }
  });

  lastRenderedVersionId = null;
  lastWasDeepDive = false;
}

log("results.js fully initialized");
