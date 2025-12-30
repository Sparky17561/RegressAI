import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Info } from 'lucide-react';
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
    <div className="login-page-wrapper min-h-screen flex items-center justify-center p-6 selection:bg-[var(--color-maintext)] selection:text-[var(--color-background)] relative overflow-hidden">
      {/* Decorative background accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full z-0"></div>

      <div className="animate-load w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 font-bbh text-3xl tracking-tighter uppercase mb-2 font-medium">
            <img src="/logo.png" alt="RegressAI" className="w-10 h-10 object-contain" />
            RegressAI
          </Link>
          <p className="font-lora text-[var(--color-subtext)] italic">
            Securely access your evaluation dashboard.
          </p>
        </div>

        <div className="bg-[var(--color-bg-light)]/80 backdrop-blur-md border border-[var(--border)] rounded-3xl p-8 shadow-[var(--shadow)] animate-appear">
          <div className="mb-8">
            <h2 className="font-bbh text-2xl uppercase mb-2">Sign In</h2>
            <p className="font-gothic text-xs text-[var(--color-subtext)] uppercase tracking-widest">
              Evaluate LLM regressions with deterministic logic.
            </p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm font-gothic uppercase tracking-wider">
              <Info className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full group font-gothic uppercase tracking-widest border border-[var(--border)] py-4 px-8 rounded-xl hover:bg-[var(--color-bg)] transition-all flex items-center justify-center gap-3 bg-[var(--color-bg-light)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--color-maintext)] rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="mt-8 text-center">
            <p className="font-lora text-[var(--color-subtext)] text-[10px] italic leading-relaxed">
              By signing in, you agree to our{' '}
              <a href="#" className="underline hover:text-[var(--color-maintext)] transition-colors">Terms of Service</a>{' '}
              and{' '}
              <a href="#" className="underline hover:text-[var(--color-maintext)] transition-colors">Privacy Policy</a>.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link 
            to="/" 
            className="font-gothic text-[10px] uppercase tracking-[0.2em] text-[var(--color-subtext)] hover:text-[var(--color-maintext)] transition-colors flex items-center justify-center gap-2"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;