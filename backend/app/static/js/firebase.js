// static/js/firebase.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as _onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDz27VlEzyviseuiUPHxsgO0wmb_29yjko",
  authDomain: "techsprint-32cd2.firebaseapp.com",
  projectId: "techsprint-32cd2",
  storageBucket: "techsprint-32cd2.firebasestorage.app",
  messagingSenderId: "865435723706",
  appId: "1:865435723706:web:91831746297d784698df83"
};

// Initialize once
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Core exports
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// 🔑 KEEP SAME NAME YOU WANT
export const onAuthStateChanged = (authInstance, callback) =>
  _onAuthStateChanged(authInstance, callback);

// Helpers
export const firebaseSignIn = () => signInWithPopup(auth, provider);
export const firebaseSignOut = () => signOut(auth);
