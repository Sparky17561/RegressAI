// settings.js - Settings Modal Module (FIXED)
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
  
  // 🔥 FIX: Check premium status from localStorage
  const cachedPremium = localStorage.getItem('premium_status');
  let isPremium = false;
  
  if (cachedPremium) {
    try {
      const premiumData = JSON.parse(cachedPremium);
      isPremium = premiumData.is_premium || premiumData.tier === "pro";
    } catch (e) {
      console.error("Failed to parse premium data:", e);
    }
  }
  
  // Load current API key status
  try {
    const data = await checkApiKeyStatus();
    const statusEl = $('apiKeyStatus');
    const keyInput = $('geminiApiKey');
    const apiKeyHint = $('apiKeyHint');
    
    if (isPremium) {
      // 🔥 FIX: Show premium message
      if (statusEl) {
        statusEl.innerHTML = `<span class="status-success">✓ Using RegressAI Premium API</span>`;
      }
      
      // Disable input and show placeholder
      if (keyInput) {
        keyInput.disabled = true;
        keyInput.value = "";
        keyInput.placeholder = "🔒 Premium: No API key needed";
      }
      
      // Show hint
      if (apiKeyHint) {
        apiKeyHint.style.display = "block";
        apiKeyHint.innerHTML = '<span class="status-success">✨ Premium users don\'t need to provide their API key. We use RegressAI\'s API for all analysis.</span>';
      }
    } else {
      // 🔥 FIX: Free user - show actual API key preview
      if (statusEl) {
        if (data.has_api_key) {
          statusEl.innerHTML = `<span class="status-success">✓ API key configured</span>`;
        } else {
          statusEl.innerHTML = '<span class="status-warning">⚠ No API key configured</span>';
        }
      }
      
      // 🔥 FIX: Show API key preview in input if exists
      if (keyInput) {
        keyInput.disabled = false;
        if (data.has_api_key && data.api_key_preview) {
          // Show preview with asterisks
          keyInput.placeholder = `Current: ${data.api_key_preview}`;
          keyInput.value = ""; // Clear value, user can type new one
        } else {
          keyInput.placeholder = "Enter your Groq API key";
          keyInput.value = "";
        }
      }
      
      // Hide premium hint
      if (apiKeyHint) {
        apiKeyHint.style.display = "none";
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
  if (keyInput) {
    keyInput.value = '';
    keyInput.disabled = false; // Re-enable in case it was disabled
  }
}

export async function saveSettings() {
  // Check if premium
  const cachedPremium = localStorage.getItem('premium_status');
  let isPremium = false;
  
  if (cachedPremium) {
    try {
      const premiumData = JSON.parse(cachedPremium);
      isPremium = premiumData.is_premium || premiumData.tier === "pro";
    } catch (e) {
      console.error("Failed to parse premium data:", e);
    }
  }
  
  if (isPremium) {
    alert("Premium users don't need to configure an API key. RegressAI provides the API for you!");
    closeSettings();
    return;
  }
  
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