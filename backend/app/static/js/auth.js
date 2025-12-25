// auth.js - Authentication Module
import { auth, onAuthStateChanged, firebaseSignOut } from "./firebase.js";
import { initUser, checkApiKeyStatus } from "./api.js";
import { loadCases } from "./cases.js";
import { updateStatusText } from "./ui.js";
import { loadNotifications } from "./collaboration.js"; // ✅ ADD THIS

export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login";
    } else {
      window.currentUser = user;
      window.onAuthReady?.();
      console.log("Logged in:", user.email);

      await initUser(user.uid, user.email, user.displayName);
      await checkApiKeyStatus();
      await loadCases();
      updateStatusText(`Signed in: ${user.email}`);
      
      // ✅ ADD THIS - Load notifications after auth completes
      setTimeout(() => {
        loadNotifications();
      }, 500);
    }
  });
}

export async function logout() {
  await firebaseSignOut();
  window.location.href = "/login";
}

window.logout = logout;