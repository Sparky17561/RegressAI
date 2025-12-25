// inputs.js - Input Change Detection & Management
import { appState } from "./state.js";
import { updateAnalyzeButton } from "./ui.js";
import { $ } from "./utils.js";

export function captureCurrentInputs() {
  return {
    oldApi: $("oldApi")?.value || "",
    newApi: $("newApi")?.value || "",
    envVars: $("envVars")?.value || "",
    bodyTemplate: $("bodyTemplate")?.value || "",
    responsePath: $("responsePath")?.value || "",
    goal: $("goal")?.value || "",
    oldPrompt: $("oldPrompt")?.value || "",
    newPrompt: $("newPrompt")?.value || "",
    numCases: $("numCases")?.value || "",
    questionsManual: $("questionsManual")?.value || ""
  };
}

export function hasInputsChanged() {
  const current = captureCurrentInputs();
  const last = appState.lastRunInputs;
  
  return Object.keys(current).some(key => current[key] !== last[key]);
}

export function setupInputChangeListeners() {
  const inputs = [
    "oldApi", "newApi", "envVars", "bodyTemplate", "responsePath",
    "goal", "oldPrompt", "newPrompt", "numCases", "questionsManual"
  ];
  
  inputs.forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("input", () => {
        appState.hasUnsavedChanges = hasInputsChanged();
        updateAnalyzeButton();
      });
    }
  });
}