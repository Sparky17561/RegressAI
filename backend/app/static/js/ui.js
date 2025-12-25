// ui.js - UI Rendering & Updates Module
import { appState } from "./state.js";
import { selectCase } from "./cases.js";
import { loadVersionsForCase } from "./versions.js";
import { $, escapeHtml } from "./utils.js";

export function renderCasesSidebar() {
  const container = $("casesList");
  if (!container) return;
  
  if (appState.cases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No cases yet</p>
        <button class="btn primary" onclick="createNewCase()">+ Create First Case</button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = appState.cases.map(c => {
    const isActive = c.case_id === appState.activeCaseId;
    
    return `
      <div class="case-item ${isActive ? 'active' : ''}" data-case-id="${c.case_id}">
        <div class="case-header" onclick="toggleCaseVersions('${c.case_id}')">
          <span class="expand-icon">▶</span>
          <div class="case-name">${escapeHtml(c.name)}</div>
          <div class="case-meta">${c.version_count} version${c.version_count !== 1 ? 's' : ''}</div>
        </div>
        <div class="case-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); renameCase('${c.case_id}')" title="Rename">✏️</button>
          <button class="btn-icon" onclick="event.stopPropagation(); deleteCase('${c.case_id}')" title="Delete">🗑️</button>
        </div>
        <div class="versions-list" id="versions-${c.case_id}" style="display:none"></div>
      </div>
    `;
  }).join("");
  
  // Auto-expand active case and load its versions
  if (appState.activeCaseId) {
    const activeCase = container.querySelector(`[data-case-id="${appState.activeCaseId}"]`);
    if (activeCase) {
      const expandIcon = activeCase.querySelector('.expand-icon');
      if (expandIcon) expandIcon.textContent = '▼';
      
      const versionsEl = $(`versions-${appState.activeCaseId}`);
      if (versionsEl) {
        versionsEl.style.display = 'block';
        loadVersionsForCase(appState.activeCaseId);
      }
    }
  }
}

export async function toggleCaseVersions(caseId) {
  const versionsEl = $(`versions-${caseId}`);
  const caseItem = document.querySelector(`[data-case-id="${caseId}"]`);
  const expandIcon = caseItem?.querySelector('.expand-icon');
  
  if (!versionsEl) return;
  
  // If clicking the same case, just toggle versions visibility
  if (appState.activeCaseId === caseId) {
    const isVisible = versionsEl.style.display === 'block';
    versionsEl.style.display = isVisible ? 'none' : 'block';
    
    // Update expand icon
    if (expandIcon) {
      expandIcon.textContent = isVisible ? '▶' : '▼';
    }
    
    // Load versions if showing for the first time
    if (!isVisible) {
      await loadVersionsForCase(caseId);
    }
  } else {
    // Selecting a different case - this will trigger renderCasesSidebar which handles expansion
    await selectCase(caseId);
  }
}

export function updateAnalyzeButton() {
  const btn = document.querySelector('.btn-analyze');
  if (!btn) return;
  
  if (!appState.hasApiKey) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.title = "Configure Gemini API key in Settings first";
  } else if (appState.hasUnsavedChanges) {
    btn.disabled = false;
    btn.classList.remove('disabled');
    btn.title = "";
  } else if (appState.activeVersionId) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.title = "Change any input to run a new version";
  }
}

export function updateStatusText(text) {
  const el = $("statusText");
  if (el) el.innerText = text;
}

// Expose to global scope
window.toggleCaseVersions = toggleCaseVersions;