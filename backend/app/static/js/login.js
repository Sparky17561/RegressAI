// static/js/login.js
import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "/app";
  }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "/app";
  } catch (e) {
    alert(e.message);
  }
});
