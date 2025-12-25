// utils.js - Utility Functions

export const $ = id => document.getElementById(id);

export function escapeHtml(text) {
  if (!text) return "";
  return String(text).replace(/[&<>"']/g, function (m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

export function showTab(evt) {
  const tabName = evt.currentTarget.dataset.tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  evt.currentTarget.classList.add("active");

  document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
  const pane = $("tab-" + tabName);
  if (pane) pane.classList.add("active");
}

// Expose to global scope
window.showTab = showTab;