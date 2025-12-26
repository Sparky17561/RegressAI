// auth.js - Authentication Module
import { auth, onAuthStateChanged, firebaseSignOut } from "./firebase.js";
import { initUser, checkApiKeyStatus } from "./api.js";
import { loadCases } from "./cases.js";
import { updateStatusText } from "./ui.js";
import { loadNotifications } from "./collaboration.js"; // ✅ ADD THIS

// ============================================
// AUTH INITIALIZATION
// ============================================

export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login";
    } else {
      window.currentUser = user;

      // 🔥 IMPORTANT: Fire auth-ready AFTER user is set
      console.log("[AUTH] Logged in:", user.email);
      window.onAuthReady?.();
      window.dispatchEvent(new Event("auth-ready"));

      // --------------------------------------------
      // Backend user init
      // --------------------------------------------
      await initUser(user.uid, user.email, user.displayName);

      // --------------------------------------------
      // API key status (for free users)
      // --------------------------------------------
      await checkApiKeyStatus();

      // --------------------------------------------
      // Load initial app data
      // --------------------------------------------
      await loadCases();

      updateStatusText(`Signed in: ${user.email}`);

      // --------------------------------------------
      // 🔥 CRITICAL FIX: Trigger premium re-check
      // This guarantees premium.js runs AFTER auth
      // --------------------------------------------
      console.log("[AUTH] Dispatching premium-ready");
      window.dispatchEvent(new Event("premium-ready"));

      // --------------------------------------------
      // Notifications (slightly delayed)
      // --------------------------------------------
      setTimeout(() => {
        loadNotifications();
      }, 500);
    }
  });
}

// ============================================
// LOGOUT
// ============================================

export async function logout() {
  await firebaseSignOut();
  window.location.href = "/login";
}

window.logout = logout;
