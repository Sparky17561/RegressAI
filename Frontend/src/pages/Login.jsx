import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signInWithGoogle, currentUser, authError } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate('/app');
    }
  }, [currentUser, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      navigate('/app');
    } catch (err) {
      // Error is already set in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">🧠</div>
            <h1>RegressAI</h1>
          </div>
          <p className="login-subtitle">
            Sign in to evaluate LLM regressions, prompt changes, and safety drift.
          </p>
        </div>

        <div className="login-content">
          {authError && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="btn-google"
          >
            {isLoading ? (
              <div className="loading-spinner small"></div>
            ) : (
              <>
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <div className="login-divider">
            <span>or</span>
          </div>

          <button
            onClick={() => navigate('/app')}
            className="btn-demo"
          >
            <span className="demo-icon">🎮</span>
            Continue as Demo User
          </button>

          <div className="login-terms">
            <p className="small-text">
              By signing in, you agree to our{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </p>
          </div>
        </div>

        <div className="login-footer">
          <p className="small-text">
            Need help? <a href="mailto:support@regressai.com">Contact support</a>
          </p>
        </div>
      </div>

      {/* Background Elements */}
      <div className="login-bg">
        <div className="bg-grid"></div>
        <div className="bg-shapes">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-shape" style={{
              left: `${10 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`
            }}></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Login;