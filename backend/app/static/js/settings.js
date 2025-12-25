// settings.js - Settings Modal Module
import { checkApiKeyStatus, saveApiKey } from "./api.js";
import { appState } from "./state.js";
import { $ } from "./utils.js";

export function showApiKeyWarning() {
  // Remove existing warning
  const existing = document.querySelector('.api-key-warning');
  if (existing) existing.remove();

  const warning = document.createElement('div');
  warning.className = 'api-key-warning';
  warning.innerHTML = `
    <div class="warning-content">
      <span class="warning-icon">⚠️</span>
      <span>Gemini API key not configured. Please add your API key in Settings to run analyses.</span>
      <button class="btn-link" id="configureNowBtn">Configure Now</button>
    </div>
  `;
  
  const setupPanel = document.querySelector('.setup-panel');
  if (setupPanel) {
    setupPanel.prepend(warning);
    
    // Add event listener to the button
    const configBtn = document.getElementById('configureNowBtn');
    if (configBtn) {
      configBtn.addEventListener('click', openSettings);
    }
  }
}

export async function openSettings() {
  const modal = $('settingsModal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  
  // Load current API key status
  try {
    const data = await checkApiKeyStatus();
    const statusEl = $('apiKeyStatus');
    if (statusEl) {
      if (data.has_api_key) {
        statusEl.innerHTML = `<span class="status-success">✓ API key configured (${data.api_key_preview})</span>`;
      } else {
        statusEl.innerHTML = '<span class="status-warning">⚠ No API key configured</span>';
      }
    }
  } catch (e) {
    console.error("Failed to load API key status:", e);
  }
}

export function closeSettings() {
  const modal = $('settingsModal');
  const keyInput = $('geminiApiKey');
  
  if (modal) modal.style.display = 'none';
  if (keyInput) keyInput.value = '';
}

export async function saveSettings() {
  const apiKey = $('geminiApiKey')?.value?.trim();
  
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }
  
  try {
    await saveApiKey(apiKey);
    
    // Remove warning if present
    const warning = document.querySelector('.api-key-warning');
    if (warning) warning.remove();
    
    // Update state
    appState.hasApiKey = true;
    
    closeSettings();
    alert('API key saved successfully!');
    
    // Reload the page to update UI
    window.location.reload();
  } catch (e) {
    console.error('Failed to save API key:', e);
    alert('Failed to save API key: ' + e.message);
  }
}

// Initialize modal handlers
export function initSettingsHandlers() {
  document.addEventListener('DOMContentLoaded', () => {
    // Settings modal buttons
    const closeBtn = $('closeSettingsBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    
    const cancelBtn = $('cancelSettingsBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSettings);
    
    const saveBtn = $('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    
    // Click outside to close
    window.addEventListener('click', (event) => {
      const modal = $('settingsModal');
      if (event.target === modal) {
        closeSettings();
      }
    });
  });
}

// Expose to global scope
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;