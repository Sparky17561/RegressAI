// state.js - Global State Management

export const appState = {
  cases: [],
  activeCaseId: null,
  activeVersionId: null,
  currentInputs: {},
  lastRunInputs: {},
  hasUnsavedChanges: false,
  hasApiKey: false
};

export function updateState(updates) {
  Object.assign(appState, updates);
}

export function getState() {
  return appState;
}

// Initialize global references
window.currentUser = null;
window.appState = appState;