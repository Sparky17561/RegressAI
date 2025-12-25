// api.js - API Communication Module
import { appState } from "./state.js";

export async function initUser(userId, email, displayName) {
  try {
    await fetch("/api/user/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, email, display_name: displayName })
    });
  } catch (e) {
    console.error("User init failed:", e);
  }
}

export async function checkApiKeyStatus() {
  try {
    const res = await fetch("/api/user/api-key/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: window.currentUser.uid })
    });
    const data = await res.json();
    appState.hasApiKey = data.has_api_key;
    
    return data;
  } catch (e) {
    console.error("API key check failed:", e);
    return { has_api_key: false };
  }
}

export async function saveApiKey(apiKey) {
  const res = await fetch('/api/user/api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: window.currentUser.uid,
      api_key: apiKey
    })
  });
  
  if (!res.ok) throw new Error('Failed to save API key');
  
  appState.hasApiKey = true;
  return true;
}

export async function fetchCases() {
  const res = await fetch("/api/cases/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: window.currentUser.uid })
  });
  return await res.json();
}

export async function fetchCase(caseId) {
  const res = await fetch("/api/cases/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id: window.currentUser.uid,
      case_id: caseId
    })
  });
  if (!res.ok) throw new Error("Case not found");
  return await res.json();
}

export async function createCase(name, description = "") {
  const res = await fetch("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: window.currentUser.uid,
      name: name,
      description: description
    })
  });
  
  if (!res.ok) throw new Error("Failed to create case");
  return await res.json();
}

export async function updateCase(caseId, updates) {
  await fetch("/api/cases/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id: window.currentUser.uid,
      case_id: caseId,
      ...updates
    })
  });
}

export async function deleteCase(caseId) {
  await fetch("/api/cases/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id: window.currentUser.uid,
      case_id: caseId
    })
  });
}

export async function fetchVersion(versionId) {
  const res = await fetch("/api/versions/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id: window.currentUser.uid,
      version_id: versionId
    })
  });
  if (!res.ok) throw new Error("Version not found");
  return await res.json();
}

export async function fetchVersions(caseId) {
  const res = await fetch("/api/versions/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      user_id: window.currentUser.uid,
      case_id: caseId
    })
  });
  return await res.json();
}

export async function runAnalysisAPI(payload) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }

  return await res.json();
}

export async function fetchTeamMembers(caseId) {
  const res = await fetch("/api/team/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: window.currentUser.uid,
      case_id: caseId
    })
  });
  return res.json();
}
