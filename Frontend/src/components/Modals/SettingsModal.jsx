import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { usePremium } from '../../contexts/PremiumContext';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose, isPremium }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { checkSubscription } = usePremium();

  useEffect(() => {
    if (isOpen) {
      loadApiKeyStatus();
    }
  }, [isOpen]);

  const loadApiKeyStatus = async () => {
    try {
      setLoading(true);
      const status = await apiService.getApiKeyStatus();
      setApiKeyStatus(status);
      
      // If user has API key, show it (masked initially)
      if (status.has_api_key) {
        // For security, don't fetch the actual key from backend
        // Instead, we'll show placeholder indicating key exists
        setApiKey('••••••••••••••••••••••');
      } else {
        setApiKey('');
      }
    } catch (error) {
      console.error('Failed to load API key status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // If key is masked, don't update
    if (apiKey === '••••••••••••••••••••••') {
      alert('Please enter a new API key or leave empty to keep current one');
      return;
    }

    try {
      setSaving(true);
      
      if (apiKey.trim()) {
        // Save new API key
        await apiService.saveApiKey(apiKey);
        alert('API key updated successfully!');
      } else {
        // Clear API key if empty
        await apiService.saveApiKey('');
        alert('API key cleared successfully!');
      }
      
      onClose();
      await checkSubscription();
    } catch (error) {
      alert(`Failed to save API key: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = () => {
    if (confirm('Are you sure you want to clear your API key? You won\'t be able to run analyses until you add a new one.')) {
      setApiKey('');
      setShowApiKey(false);
    }
  };

  const handleToggleShowKey = () => {
    if (apiKey === '••••••••••••••••••••••') {
      // If showing masked key, prompt user to enter new one
      if (confirm('For security, we cannot show your existing API key. To update it, please enter a new API key.')) {
        setApiKey('');
        setShowApiKey(true);
      }
    } else {
      setShowApiKey(!showApiKey);
    }
  };

  const handleCopyToClipboard = async () => {
    if (apiKey && apiKey !== '••••••••••••••••••••••') {
      try {
        await navigator.clipboard.writeText(apiKey);
        alert('API key copied to clipboard!');
      } catch (error) {
        alert('Failed to copy to clipboard');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-icon close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3>API Configuration</h3>
            
            {isPremium ? (
              <div className="premium-settings">
                <div className="premium-badge large">
                  <span className="badge premium">✨ PRO</span>
                  <span className="premium-text">Premium User</span>
                </div>
                <div className="premium-info">
                  <p>
                    🎉 You're using RegressAI Premium! 
                    We provide the API key for all your analyses.
                  </p>
                  <p className="small-text">
                    No need to configure your own API key. Enjoy unlimited analysis with our infrastructure.
                  </p>
                </div>
              </div>
            ) : (
              <div className="api-key-settings">
                <div className="input-group">
                  <div className="input-header">
                    <label htmlFor="apiKey">Groq API Key</label>
                    <div className="input-actions">
                      <button
                        type="button"
                        className="btn-link small"
                        onClick={handleToggleShowKey}
                        disabled={loading}
                      >
                        {showApiKey ? '👁️ Hide' : '👁️ Show'}
                      </button>
                      {apiKey && apiKey !== '••••••••••••••••••••••' && (
                        <button
                          type="button"
                          className="btn-link small"
                          onClick={handleCopyToClipboard}
                        >
                          📋 Copy
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="input-with-icon">
                    <input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        apiKeyStatus?.has_api_key && apiKey === '••••••••••••••••••••••'
                          ? 'Existing API key configured (enter new one to update)'
                          : 'Enter your Groq API key'
                      }
                      disabled={loading || saving}
                      className={apiKey === '••••••••••••••••••••••' ? 'masked-key' : ''}
                    />
                    {apiKey && apiKey !== '••••••••••••••••••••••' && (
                      <button
                        type="button"
                        className="clear-btn"
                        onClick={() => setApiKey('')}
                        disabled={loading || saving}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  <div className="input-hint">
                    Get your API key from{' '}
                    <a 
                      href="https://console.groq.com/keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Groq Console
                    </a>
                    {' • '}
                    <button
                      type="button"
                      className="btn-link small"
                      onClick={handleClearKey}
                      disabled={loading || saving || !apiKeyStatus?.has_api_key}
                    >
                      Clear existing key
                    </button>
                  </div>
                  
                  {loading ? (
                    <div className="status-loading">
                      <div className="spinner small"></div>
                      <span>Checking API key status...</span>
                    </div>
                  ) : apiKeyStatus && (
                    <div className={`status-message ${apiKeyStatus.has_api_key ? 'success' : 'warning'}`}>
                      {apiKeyStatus.has_api_key ? (
                        <>
                          <span className="status-icon">✓</span>
                          <span>API key is configured • Last updated: {apiKeyStatus.last_updated || 'Recently'}</span>
                        </>
                      ) : (
                        <>
                          <span className="status-icon">⚠️</span>
                          <span>No API key configured. Add one to run analyses.</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="key-notes">
                  <h4>Important Notes:</h4>
                  <ul>
                    <li>Your API key is encrypted and stored securely</li>
                    <li>We never log or store your API key in plain text</li>
                    <li>You can update your key at any time</li>
                    <li>Keys are only used for your analysis requests</li>
                  </ul>
                </div>

                <div className="free-tier-info">
                  <h4>Free Tier Limitations</h4>
                  <ul>
                    <li>Max 10 test cases per analysis</li>
                    <li>Basic analysis only (no deep dive)</li>
                    <li>Uses your Groq API key</li>
                    <li>Standard response time</li>
                  </ul>
                  <p className="upgrade-hint">
                    Want more?{' '}
                    <a href="#pricing" onClick={(e) => {
                      e.preventDefault();
                      onClose();
                      window.location.hash = '#pricing';
                    }}>
                      Upgrade to Premium
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          {!isPremium && (
            <button 
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading || saving || apiKey === '••••••••••••••••••••••'}
            >
              {saving ? (
                <>
                  <div className="spinner small"></div>
                  Saving...
                </>
              ) : apiKeyStatus?.has_api_key && apiKey === '••••••••••••••••••••••' ? (
                'Keep Current Key'
              ) : apiKey.trim() ? (
                'Save API Key'
              ) : (
                'Clear API Key'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;