// App.jsx - FIXED VERSION
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AuthProvider } from './contexts/AuthContext';
import { PremiumProvider } from './contexts/PremiumContext';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check auth status
    const checkAuth = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="brain-logo">🧠</div>
          <p>Loading RegressAI...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <PremiumProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app/*" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </PremiumProvider>
    </AuthProvider>
  );
}

// ✅ MAKE SURE THIS LINE IS PRESENT:
export default App;