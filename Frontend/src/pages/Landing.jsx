import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const Landing = () => {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(true);
  }, []);

  const features = [
    {
      icon: '📊',
      title: 'Deterministic Diffs',
      description: 'Automatically detect length changes, tone shifts, keyword removals between API versions.'
    },
    {
      icon: '⚖️',
      title: 'LLM Safety Judge',
      description: 'AI-powered analysis flags safety regressions before they hit production.'
    },
    {
      icon: '🔥',
      title: 'Cookedness Scoring',
      description: 'Get a single 0-100 score that tells you exactly how risky your changes are.'
    },
    {
      icon: '🕰️',
      title: 'Version Control',
      description: 'Every analysis run is saved as an immutable version. Track changes over time.'
    },
    {
      icon: '💡',
      title: 'Prompt Insights',
      description: 'AI-powered suggestions identify root causes and provide actionable fixes.'
    },
    {
      icon: '⚡',
      title: 'Fast & Local',
      description: 'Run entirely on your infrastructure. No data leaves your network.'
    }
  ];

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className={`hero-content ${animated ? 'animated' : ''}`}>
          <div className="logo-hero">
            <div className="logo-icon">🧠</div>
            <h1 className="logo-text">RegressAI</h1>
          </div>
          
          <h1 className="hero-title">
            Stop Guessing if Your Prompt Change
            <span className="highlight"> Broke Production</span>
          </h1>
          
          <p className="hero-subtitle">
            RegressAI compares LLM changes with deterministic diffs, safety judges, and versioned experiments.
            Ship with confidence. Never break prod again.
          </p>
          
          <div className="hero-buttons">
            <Link to="/login" className="btn btn-primary">
              <span className="btn-icon">🔐</span>
              Login with Google
            </Link>
            <Link to="/app" className="btn btn-secondary">
              <span className="btn-icon">🎮</span>
              View Demo
            </Link>
          </div>
        </div>
        
        {/* Animated Background */}
        <div className="hero-bg">
          <div className="bg-gradient"></div>
          <div className="bg-particles">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="particle" style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}></div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow Section */}
      <section className="flow-section">
        <h2>How It Works</h2>
        <div className="flow-diagram">
          <div className="flow-step">
            <div className="flow-icon">📝</div>
            <h3>Old Prompt</h3>
            <p>Your current production API</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">✨</div>
            <h3>New Prompt</h3>
            <p>Your proposed changes</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">🔬</div>
            <h3>Analysis</h3>
            <p>Side-by-side comparison</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-icon">✅</div>
            <h3>Verdict</h3>
            <p>Ship with confidence</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2>Built for Developers, Not Marketers</h2>
          <p className="section-subtitle">Everything you need to ship LLM changes safely</p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="feature-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-card">
          <h2>Ready to Ship with Confidence?</h2>
          <p>Join thousands of developers who trust RegressAI for their LLM deployments.</p>
          <div className="cta-buttons">
            <Link to="/login" className="btn btn-primary btn-large">
              Get Started Free
            </Link>
            <Link to="/app" className="btn btn-outline btn-large">
              Try Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon small">🧠</div>
            <span className="logo-text">RegressAI</span>
          </div>
          <p className="footer-copyright">
            &copy; 2025 RegressAI • Built for developers who care about quality
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;