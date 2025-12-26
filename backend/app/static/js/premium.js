// static/js/premium.js - Fixed Premium Features Module
// No duplicate exports. runDeepDive is exported only once (at definition).

import { appState } from "./state.js";
import { $, showTab } from "./utils.js";
import { captureCurrentInputs } from "./inputs.js";
import { updateStatusText } from "./ui.js";
import { loadCases } from "./cases.js";

let userSubscription = {
  tier: "free",
  is_premium: false,
  deep_dives_remaining: 0
};

// Check subscription on load
export async function checkSubscription() {
  if (!window.currentUser) {
    console.log("[PREMIUM] No user logged in");
    return;
  }

  try {
    console.log("[PREMIUM] Checking subscription for user:", window.currentUser.uid);

    const res = await fetch("/api/subscription/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: window.currentUser.uid })
    });

    if (res.ok) {
      const data = await res.json();

      // Normalize tier value
      userSubscription = {
        tier: String(data.tier).toLowerCase(),
        is_premium: Boolean(data.is_premium || data.tier === "pro"),
        deep_dives_remaining: parseInt(data.deep_dives_remaining) || 0
      };

      console.log("[PREMIUM] ✅ Subscription loaded:", userSubscription);

      // Persist locally as fallback
      localStorage.setItem('premium_status', JSON.stringify(userSubscription));

      updatePremiumUI();
    } else {
      console.error("[PREMIUM] ❌ API call failed:", res.status);

      // Try loading from localStorage as fallback
      const cached = localStorage.getItem('premium_status');
      if (cached) {
        userSubscription = JSON.parse(cached);
        console.log("[PREMIUM] Loaded from cache:", userSubscription);
        updatePremiumUI();
      }
    }
  } catch (err) {
    console.error("[PREMIUM] ❌ Error:", err);

    // Load from localStorage on error
    const cached = localStorage.getItem('premium_status');
    if (cached) {
      userSubscription = JSON.parse(cached);
      console.log("[PREMIUM] Loaded from cache after error:", userSubscription);
      updatePremiumUI();
    }
  }
}

function updatePremiumUI() {
  const isPremium = userSubscription.is_premium;

  console.log("[PREMIUM UI] Updating UI");
  console.log("[PREMIUM UI] Is Premium:", isPremium);
  console.log("[PREMIUM UI] Deep Dives:", userSubscription.deep_dives_remaining);

  const elements = {
    deepDiveBtn: $("btnDeepDive"),
    premiumBadge: $("premiumBadge"),
    premiumUpsell: $("premiumUpsell"),
    visualizationsTab: document.querySelector('[data-tab="visualizations"]'),
    apiKeyHint: $("apiKeyHint"),
    remainingEl: $("deepDivesRemaining")
  };

  // Deep Dive Button
  if (elements.deepDiveBtn) {
    elements.deepDiveBtn.style.display = isPremium ? "inline-block" : "none";
    console.log("[PREMIUM UI] Deep Dive button:", elements.deepDiveBtn.style.display);
  }

  // Premium Badge
  if (elements.premiumBadge) {
    elements.premiumBadge.style.display = isPremium ? "flex" : "none";

    if (elements.remainingEl && isPremium) {
      elements.remainingEl.textContent = `${userSubscription.deep_dives_remaining} deep dives left`;
    }
  }

  // Upsell (show for free users)
  if (elements.premiumUpsell) {
    elements.premiumUpsell.style.display = isPremium ? "none" : "block";
  }

  // Visualizations Tab
  if (elements.visualizationsTab) {
    elements.visualizationsTab.style.display = isPremium ? "inline-block" : "none";
  }

  // API Key Hint
  if (elements.apiKeyHint) {
    elements.apiKeyHint.style.display = isPremium ? "block" : "none";
  }

  // Force layout recalculation
  document.body.offsetHeight;

  console.log("[PREMIUM UI] ✅ UI update complete");
}

// Deep Dive Analysis
export async function runDeepDive() {
  if (!window.currentUser) {
    alert("Please sign in first");
    return;
  }

  console.log("[DEEP DIVE] Starting");
  console.log("[DEEP DIVE] Premium:", userSubscription.is_premium);
  console.log("[DEEP DIVE] Remaining:", userSubscription.deep_dives_remaining);

  if (!userSubscription.is_premium) {
    console.log("[DEEP DIVE] Not premium, showing modal");
    openPricingModal();
    return;
  }

  if (userSubscription.deep_dives_remaining <= 0) {
    alert("You've used all your deep dives for this month. Deep dives reset monthly.");
    return;
  }

  const payload = {
    user_id: window.currentUser.uid,
    case_id: appState.activeCaseId || null,
    case_name: appState.activeCaseId ? undefined : ($("caseName")?.value || "Deep Dive Analysis"),
    mode: "adversarial",
    old_api: $("oldApi")?.value?.trim() || "",
    new_api: $("newApi")?.value?.trim() || "",
    env: $("envVars")?.value || "{}",
    body_template: $("bodyTemplate")?.value || '{ "prompt": "{{question}}" }',
    response_path: $("responsePath")?.value || "choices[0].message.content",
    goal: $("goal")?.value || "",
    old_prompt: $("oldPrompt")?.value || "",
    new_prompt: $("newPrompt")?.value || "",
    n_cases: parseInt($("numCases")?.value) || 10,
    manual_questions: []
  };

  // Show loading
  const summaryTab = document.querySelector('[data-tab="summary"]');
  if (summaryTab) {
    showTab({ currentTarget: summaryTab });
  }

  const summaryCard = $("summaryCard");
  if (summaryCard) {
    summaryCard.innerHTML = `<div class="loading">
      <div class="spinner"></div>
      <p>🔬 Running deep dive analysis...</p>
      <p class="small">Generating test cases and computing advanced metrics</p>
    </div>`;
  }

  updateStatusText("Deep Dive Running");

  const btn = $("btnDeepDive");
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    const res = await fetch("/api/deep-dive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Deep dive failed");
    }

    const data = await res.json();
    console.log("[DEEP DIVE] ✅ Success:", data);

    // Update state
    appState.activeCaseId = data.case_id;
    appState.activeVersionId = data.version_id;
    appState.lastRunInputs = captureCurrentInputs();
    appState.hasUnsavedChanges = false;

    // Update deep dives count and persist
    userSubscription.deep_dives_remaining = data.deep_dives_remaining || 0;
    localStorage.setItem('premium_status', JSON.stringify(userSubscription));
    updatePremiumUI();

    // Render results
    renderDeepDiveResults(data);
    updateStatusText(`Deep Dive Complete • v${data.version_number}`);

    // Reload cases
    await loadCases();

    // Auto-switch to visualizations tab if available
    const vizTab = document.querySelector('[data-tab="visualizations"]');
    if (vizTab) {
      showTab({ currentTarget: vizTab });
    }

  } catch (err) {
    console.error("[DEEP DIVE] ❌ Error:", err);
    if (summaryCard) {
      summaryCard.innerHTML = `<div class="error">
        <b>Deep Dive Error</b>
        <pre>${err.message}</pre>
      </div>`;
    }
    updateStatusText("Error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  }
}

// Render deep dive results with visualizations
function renderDeepDiveResults(data) {
  console.log("[DEEP DIVE] Rendering results");

  // Import renderResults dynamically
  import("./results.js").then(({ renderResults }) => {
    renderResults(data);

    // Add null checks and default values
    if (data.is_deep_dive && data.visualization_data && data.deep_dive_metrics) {
      renderVisualizations(data.visualization_data, data.deep_dive_metrics);
    } else {
      console.warn("[DEEP DIVE] Missing visualization data:", {
        is_deep_dive: data.is_deep_dive,
        has_viz: !!data.visualization_data,
        has_metrics: !!data.deep_dive_metrics
      });
    }
  }).catch(err => {
    console.error("[DEEP DIVE] Failed to import results.js:", err);
  });
}

function renderVisualizations(vizData, deepMetrics) {
  console.log("[VISUALIZATIONS] Rendering charts");

  // Clear any existing charts
  ['radarChart', 'qualityChart', 'performanceChart', 'hallucinationChart'].forEach(id => {
    const canvas = document.getElementById(id);
    if (canvas) {
      const existingChart = Chart.getChart(canvas);
      if (existingChart) {
        existingChart.destroy();
      }
    }
  });

  // 1. Radar Chart - Metrics Comparison
  const radarCtx = document.getElementById('radarChart');
  if (radarCtx && vizData?.metrics_comparison) {
    new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: vizData.metrics_comparison.labels || [],
        datasets: [
          {
            label: 'Old Model',
            data: vizData.metrics_comparison.old_scores || [],
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
          },
          {
            label: 'New Model',
            data: vizData.metrics_comparison.new_scores || [],
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
          }
        ]
      },
      options: {
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20 }
          }
        }
      }
    });
  }

  // 2. Bar Chart - Quality Distribution
  const qualityCtx = document.getElementById('qualityChart');
  if (qualityCtx && vizData?.quality_distribution) {
    const dist = vizData.quality_distribution;
    new Chart(qualityCtx, {
      type: 'bar',
      data: {
        labels: ['Excellent', 'Good', 'Acceptable', 'Poor', 'Failed'],
        datasets: [{
          label: 'Response Count',
          data: [
            dist.excellent || 0,
            dist.good || 0,
            dist.acceptable || 0,
            dist.poor || 0,
            dist.failed || 0
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(255, 99, 132, 0.8)'
          ]
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // 3. Line Chart - Performance Over Test Cases
  const perfCtx = document.getElementById('performanceChart');
  if (perfCtx && vizData?.test_case_performance) {
    const cases = vizData.test_case_performance;
    new Chart(perfCtx, {
      type: 'line',
      data: {
        labels: cases.map(c => `Case ${c.case_number}`),
        datasets: [
          {
            label: 'Old Model Quality',
            data: cases.map(c => c.old_quality || 0),
            borderColor: 'rgba(255, 99, 132, 1)',
            fill: false
          },
          {
            label: 'New Model Quality',
            data: cases.map(c => c.new_quality || 0),
            borderColor: 'rgba(54, 162, 235, 1)',
            fill: false
          }
        ]
      },
      options: {
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Quality Score' }
          }
        }
      }
    });
  }

  // 4. Doughnut Chart - Hallucination Rate
  const hallCtx = document.getElementById('hallucinationChart');
  if (hallCtx && vizData?.hallucination_data) {
    const hall = vizData.hallucination_data;
    new Chart(hallCtx, {
      type: 'doughnut',
      data: {
        labels: ['Old Model Hallucination', 'New Model Hallucination'],
        datasets: [{
          data: [
            (hall.old_rate || 0) * 100,
            (hall.new_rate || 0) * 100
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)'
          ]
        }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  // 5. Render deep metrics text
  const deepMetricsEl = $("deepMetrics");
  if (deepMetricsEl && deepMetrics) {
    deepMetricsEl.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>🎯 Adversarial Robustness</h4>
          <div class="metric-score ${getScoreClass(deepMetrics.adversarial_robustness?.score || 0)}">
            ${deepMetrics.adversarial_robustness?.score || 0}/100
          </div>
          <p class="small">
            Failed Cases: ${deepMetrics.adversarial_robustness?.failed_cases?.length || 0}
          </p>
        </div>
        
        <div class="metric-card">
          <h4>📋 Instruction Adherence</h4>
          <div class="metric-score ${getScoreClass(deepMetrics.instruction_adherence?.score || 0)}">
            ${deepMetrics.instruction_adherence?.score || 0}/100
          </div>
          <p class="small">
            Drift Rate: ${((deepMetrics.instruction_adherence?.drift_rate || 0) * 100).toFixed(1)}%
          </p>
        </div>
        
        <div class="metric-card">
          <h4>🔄 Consistency Score</h4>
          <div class="metric-score ${getScoreClass(deepMetrics.consistency_score || 0)}">
            ${deepMetrics.consistency_score || 0}/100
          </div>
        </div>
        
        <div class="metric-card">
          <h4>🚨 Hallucination Rate</h4>
          <div class="metric-score ${getHallucinationClass(deepMetrics.hallucination_rate || 0)}">
            ${((deepMetrics.hallucination_rate || 0) * 100).toFixed(1)}%
          </div>
        </div>
        
        <div class="metric-card">
          <h4>🛡️ Safety Score</h4>
          <div class="metric-score ${getScoreClass(deepMetrics.safety_breakdown?.safety_score || 0)}">
            ${deepMetrics.safety_breakdown?.safety_score || 0}/100
          </div>
          <p class="small">
            Appropriate Refusals: ${deepMetrics.safety_breakdown?.refused_appropriately || 0}
          </p>
        </div>
        
        <div class="metric-card">
          <h4>⚡ Token Efficiency</h4>
          <div class="metric-value">
            ${(deepMetrics.token_efficiency?.efficiency_delta || 0) > 0 ? '↑' : '↓'} 
            ${Math.abs(deepMetrics.token_efficiency?.efficiency_delta || 0).toFixed(1)}%
          </div>
          <p class="small">
            Avg: ${deepMetrics.token_efficiency?.avg_tokens_new || 0} tokens
          </p>
        </div>
      </div>
      
      ${(deepMetrics.edge_case_handling || []).length > 0 ? `
        <h4>Edge Case Handling</h4>
        <div class="edge-cases">
          ${(deepMetrics.edge_case_handling || []).map(ec => `
            <div class="edge-case ${ec.handled_well ? 'success' : 'failure'}">
              <strong>${ec.case_type}</strong>
              <p>${ec.explanation}</p>
              <span class="badge ${ec.handled_well ? 'badge-success' : 'badge-critical'}">
                ${ec.handled_well ? '✓ Handled Well' : '✗ Failed'}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <h4>Performance Degradation Analysis</h4>
      <div class="degradation-analysis">
        ${(deepMetrics.performance_degradation?.degraded_on || []).length > 0 ? `
          <div class="degradation-section">
            <strong>⚠️ Degraded On:</strong>
            <ul>
              ${deepMetrics.performance_degradation.degraded_on.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${(deepMetrics.performance_degradation?.improved_on || []).length > 0 ? `
          <div class="improvement-section">
            <strong>✅ Improved On:</strong>
            <ul>
              ${deepMetrics.performance_degradation.improved_on.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <p><strong>Regression Severity:</strong> 
          <span class="badge badge-${deepMetrics.performance_degradation?.regression_severity || 'unknown'}">
            ${deepMetrics.performance_degradation?.regression_severity || 'unknown'}
          </span>
        </p>
      </div>
    `;
  }
}

function getScoreClass(score) {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-acceptable';
  return 'score-poor';
}

function getHallucinationClass(rate) {
  if (rate <= 0.1) return 'score-excellent';
  if (rate <= 0.25) return 'score-good';
  if (rate <= 0.5) return 'score-acceptable';
  return 'score-poor';
}

// Pricing Modal
function openPricingModal() {
  console.log("[PRICING] Opening modal");
  const modal = $("pricingModal");
  if (modal) {
    modal.style.display = "flex";
  }
}

function closePricingModal() {
  const modal = $("pricingModal");
  if (modal) {
    modal.style.display = "none";
  }
}

async function upgradeToPro() {
  if (!window.currentUser) {
    alert("Please sign in first");
    return;
  }

  const res = await fetch("/api/payments/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: window.currentUser.uid })
  });

  if (!res.ok) {
    console.error("[UPGRADE] Failed to create order", res.status);
    alert("Failed to initiate payment. Try again later.");
    return;
  }

  const order = await res.json();

  const options = {
    key: order.key_id,
    amount: order.amount,
    currency: order.currency,
    name: "RegressAI",
    description: "Pro Plan – ₹399",
    order_id: order.order_id,
    handler: async function (response) {

      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: window.currentUser.uid,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        })
      });

      const data = await verifyRes.json();

      if (data.success) {
        alert("🎉 Payment successful! Pro unlocked.");
        await checkSubscription(); // re-fetch from backend
        closePricingModal();
      } else {
        alert("Payment verification failed. Contact support.");
      }
    },
    theme: { color: "#6366f1" }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}


// Check premium on page load (before auth completes)
const cachedPremium = localStorage.getItem('premium_status');
if (cachedPremium) {
  try {
    userSubscription = JSON.parse(cachedPremium);
    console.log("[PREMIUM] Loaded from cache on init:", userSubscription);
    setTimeout(updatePremiumUI, 100);
  } catch (e) {
    console.error("[PREMIUM] Failed to parse cached data:", e);
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("[PREMIUM] Setting up event listeners");

  const btnDeepDive = $("btnDeepDive");
  if (btnDeepDive) {
    btnDeepDive.addEventListener("click", runDeepDive);
  }

  const upgradeLink = $("upgradeToPremiumLink");
  if (upgradeLink) {
    upgradeLink.addEventListener("click", (e) => {
      e.preventDefault();
      openPricingModal();
    });
  }

  const closePricingBtn = $("closePricingBtn");
  if (closePricingBtn) {
    closePricingBtn.addEventListener("click", closePricingModal);
  }

  const upgradeBtn = $("upgradeToPro");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", upgradeToPro);
  }
});

// Also check on auth ready
window.addEventListener('auth-ready', async () => {
  console.log("[PREMIUM] Auth ready event received");
  if (window.currentUser) {
    await checkSubscription();
  }
});

// Make functions globally available for non-module callers
window.checkSubscription = checkSubscription;
window.runDeepDive = runDeepDive;
window.openPricingModal = openPricingModal;
window.renderDeepDiveVisualizations = renderVisualizations;

// ES module exports
export { renderVisualizations };
