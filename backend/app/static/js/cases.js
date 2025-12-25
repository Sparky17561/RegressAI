// cases.js
import {
  fetchCases,
  fetchCase,
  createCase,
  updateCase,
  deleteCase as deleteCaseAPI
} from "./api.js";

import { appState } from "./state.js";
import { renderCasesSidebar } from "./ui.js";
import { selectVersion } from "./versions.js";
import { clearResults } from "./results.js";
import { loadTeamMembers, loadComments } from "./collaboration.js";

// -----------------------------
// LOAD CASES
// -----------------------------
export async function loadCases() {
  const data = await fetchCases();
  appState.cases = data.cases || [];
  renderCasesSidebar();

  if (appState.cases.length && !appState.activeCaseId) {
    selectCase(appState.cases[0].case_id);
  }
}

// -----------------------------
// SELECT CASE
// -----------------------------
export async function selectCase(caseId) {
  const data = await fetchCase(caseId);
  appState.activeCaseId = caseId;

  renderCasesSidebar();
  loadTeamMembers();

  if (data.versions?.length) {
    await selectVersion(data.versions[0].version_id);
  } else {
    clearResults();
  }
}

// -----------------------------
// CREATE / UPDATE / DELETE
// -----------------------------
export async function createNewCase() {
  const name = prompt("Enter case name:");
  if (!name) return;

  const c = await createCase(name);
  appState.cases.unshift(c);
  renderCasesSidebar();
  selectCase(c.case_id);
}

export async function renameCase(caseId) {
  const c = appState.cases.find(c => c.case_id === caseId);
  const name = prompt("Rename case:", c?.name);
  if (!name) return;

  await updateCase(caseId, { name });
  loadCases();
}

export async function deleteCase(caseId) {
  if (!confirm("Delete this case?")) return;

  await deleteCaseAPI(caseId);
  appState.activeCaseId = null;
  appState.activeVersionId = null;
  loadCases();
  clearResults();
}

// expose
window.loadCases = loadCases;
window.selectCase = selectCase;
window.createNewCase = createNewCase;
window.renameCase = renameCase;
window.deleteCase = deleteCase;
