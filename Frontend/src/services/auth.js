import { 
  auth, 
  provider, 
  signInWithPopup, 
  firebaseSignOut, 
  onAuthStateChanged 
} from '../firebase/config';

export const authService = {
  onAuthStateChanged: (callback) => {
    // Real Firebase auth state listener
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Store user info
        localStorage.setItem('user_id', user.uid);
        localStorage.setItem('user_email', user.email);
        localStorage.setItem('user_name', user.displayName);
        
        // Initialize user in backend
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          await fetch(`${API_BASE_URL}/api/user/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.uid,
              email: user.email,
              display_name: user.displayName
            })
          });
        } catch (error) {
          console.error('User initialization failed:', error);
        }
      } else {
        // Clear user info on logout
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
      }
      
      callback(user);
    });
  },
  
  signInWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Store auth token (Firebase ID token)
      const token = await user.getIdToken();
      localStorage.setItem('auth_token', token);
      
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  },
  
  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('premium_status');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  },
  
  getCurrentUser: () => {
    return auth.currentUser;
  },
  
  getAuthToken: async () => {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  }
};