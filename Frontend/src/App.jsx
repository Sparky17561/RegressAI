// App.jsx - FIXED VERSION
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing1 from './pages/Landing1';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AuthProvider } from './contexts/AuthContext';
import { PremiumProvider } from './contexts/PremiumContext';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 1. Initialize Theme immediately
    const storedTheme = localStorage.getItem("theme-mode") || "system";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const effectiveTheme = storedTheme === "system" ? systemTheme : storedTheme;
    document.documentElement.setAttribute("data-theme", effectiveTheme);

    // 2. Simulate Loading Progress
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setIsLoading(false), 200);
          return 100;
        }
        // Random increment for realistic feel
        const increment = Math.random() * 15; 
        return Math.min(prev + increment, 100);
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col justify-end pb-20 px-8 md:px-16 cursor-wait font-bbh">
        <div className="w-full max-w-4xl mx-auto">
          {/* Progress Bar Container */}
          <div className="flex justify-end mb-6">
             {/* Adjusted height to fit the massive font */}
             <div className="h-[9rem] md:h-[12rem] overflow-hidden relative flex items-end">
               <span 
                 className="block text-[8rem] md:text-[12rem] text-white leading-[0.85] tracking-tighter"
                 style={{ 
                   transform: `translateY(${100 - progress}%)`,
                   transition: 'transform 0.1s cubic-bezier(0.16, 1, 0.3, 1)' 
                 }}
               >
                 {Math.round(progress)}
               </span>
             </div>
          </div>

          <div className="w-full h-[2px] bg-[#333] overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-4 text-[#666] font-gothic text-xs uppercase tracking-widest">
            <span>System Initializing</span>
            <span>RegressAI v1.0</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <PremiumProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing1 />} />
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