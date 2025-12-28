import { useState, useEffect } from 'react';
import { usePremium } from '../contexts/PremiumContext';
import './SetupPanel.css';

const SetupPanel = ({
  activeCase,
  selectedVersion,
  onRunAnalysis,
  onDeepDive,
  onInvite,
  teamMembers
}) => {
  const { 
    is_premium: isPremium, 
    deep_dives_remaining: deepDivesRemaining,
    loading: premiumLoading,
    checkSubscription  // FIXED: Added this
  } = usePremium();

  const [formData, setFormData] = useState({
    oldApi: 'http://127.0.0.1:8000/mock/old-legal-ai',
    newApi: 'http://127.0.0.1:8000/mock/new-legal-ai',
    envVars: '{}',
    bodyTemplate: '{ "prompt": "{{question}}" }',
    responsePath: 'choices[0].message.content',
    numCases: 3,
    goal: 'Explain Indian income tax safely.',
    oldPrompt: '',
    newPrompt: '',
    questionsManual: ''
  });
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('auto');
  const [showDebug, setShowDebug] = useState(false);

  // Debug: Show current premium status
  useEffect(() => {
    console.log('SetupPanel - Premium status:', {
      isPremium,
      deepDivesRemaining,
      premiumLoading,
      localStorage: localStorage.getItem('premium_status')
    });
  }, [isPremium, deepDivesRemaining, premiumLoading]);

  // Load data from selected version
  useEffect(() => {
    if (selectedVersion) {
      const inputs = selectedVersion.request_payload 
                  || selectedVersion.analysis_response?.inputs
                  || selectedVersion.inputs;
      
      if (inputs) {
        let envValue = '{}';
        if (typeof inputs.env === 'string') {
          envValue = inputs.env;
        } else if (inputs.env && typeof inputs.env === 'object') {
          envValue = JSON.stringify(inputs.env, null, 2);
        }
        
        let bodyTemplateValue = '{ "prompt": "{{question}}" }';
        if (typeof inputs.body_template === 'string') {
          bodyTemplateValue = inputs.body_template;
        } else if (inputs.body_template && typeof inputs.body_template === 'object') {
          bodyTemplateValue = JSON.stringify(inputs.body_template, null, 2);
        }
        
        setFormData({
          oldApi: inputs.old_api || 'http://127.0.0.1:8000/mock/old-legal-ai',
          newApi: inputs.new_api || 'http://127.0.0.1:8000/mock/new-legal-ai',
          envVars: envValue,
          bodyTemplate: bodyTemplateValue,
          responsePath: inputs.response_path || 'choices[0].message.content',
          numCases: inputs.n_cases || 3,
          goal: inputs.goal || 'Explain Indian income tax safely.',
          oldPrompt: inputs.old_prompt || '',
          newPrompt: inputs.new_prompt || '',
          questionsManual: inputs.manual_questions 
            ? (Array.isArray(inputs.manual_questions) 
                ? inputs.manual_questions.join('\n') 
                : inputs.manual_questions)
            : ''
        });
        
        if (inputs.manual_questions && inputs.manual_questions.length > 0) {
          setActiveTab('manual');
        } else {
          setActiveTab('auto');
        }
      }
    }
  }, [selectedVersion]);

  // Clear form when new case is selected
  useEffect(() => {
    if (activeCase && !selectedVersion) {
      setFormData({
        oldApi: 'http://127.0.0.1:8000/mock/old-legal-ai',
        newApi: 'http://127.0.0.1:8000/mock/new-legal-ai',
        envVars: '{}',
        bodyTemplate: '{ "prompt": "{{question}}" }',
        responsePath: 'choices[0].message.content',
        numCases: 3,
        goal: 'Explain Indian income tax safely.',
        oldPrompt: '',
        newPrompt: '',
        questionsManual: ''
      });
    }
  }, [activeCase, selectedVersion]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRunAnalysis = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    try {
      // Validate JSON
      try {
        JSON.parse(formData.envVars);
      } catch (e) {
        alert('Invalid JSON in Environment Variables');
        setIsRunning(false);
        return;
      }
      
      try {
        JSON.parse(formData.bodyTemplate);
      } catch (e) {
        alert('Invalid JSON in Request Body Template');
        setIsRunning(false);
        return;
      }
      
      const hasManualQuestions = formData.questionsManual.trim().length > 0;
      const mode = hasManualQuestions ? 'manual' : 'generate';
      
      const inputs = {
        mode: mode,
        old_api: formData.oldApi.trim(),
        new_api: formData.newApi.trim(),
        env: formData.envVars,
        body_template: formData.bodyTemplate,
        response_path: formData.responsePath,
        n_cases: parseInt(formData.numCases) || 3,
        goal: formData.goal,
        old_prompt: formData.oldPrompt,
        new_prompt: formData.newPrompt,
        manual_questions: hasManualQuestions
          ? formData.questionsManual.split('\n').filter(q => q.trim())
          : []
      };
      
      console.log('Sending inputs:', inputs);
      await onRunAnalysis(inputs);
    } catch (error) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeepDive = async () => {
    if (isRunning) return;
    
    console.log('=== Deep Dive Check ===');
    console.log('isPremium from context:', isPremium);
    console.log('deepDivesRemaining:', deepDivesRemaining);
    console.log('premiumLoading:', premiumLoading);
    
    // Force refresh subscription status before checking
    try {
      const freshStatus = await checkSubscription();
      console.log('Fresh subscription status:', freshStatus);
      
      // Check the fresh status
      if (!freshStatus.is_premium) {
        console.log('Not premium after refresh, checking localStorage...');
        const cached = localStorage.getItem('premium_status');
        console.log('localStorage premium_status:', cached);
        
        if (cached) {
          try {
            const data = JSON.parse(cached);
            console.log('Parsed cache:', data);
            
            // Check if cache says pro
            if (data.is_premium || data.tier === 'pro') {
              console.log('Cache shows Pro but context does not. Reloading...');
              alert('Detected Pro status. Refreshing to update UI...');
              window.location.reload();
              return;
            }
          } catch (e) {
            console.error('Failed to parse cache:', e);
          }
        }
        
        // Still not premium, show upgrade prompt
        alert('You need to upgrade to Pro to use Deep Dive.');
        window.location.hash = '#pricing';
        return;
      }
      
      // Check deep dives remaining
      if (freshStatus.deep_dives_remaining <= 0) {
        alert('No deep dives remaining for this month.');
        return;
      }
      
      console.log('All checks passed, proceeding with deep dive');
    } catch (error) {
      console.error('Failed to check subscription:', error);
      alert('Failed to verify subscription status. Please try again.');
      return;
    }
    
    setIsRunning(true);
    try {
      // Validate JSON
      try {
        JSON.parse(formData.envVars);
      } catch (e) {
        alert('Invalid JSON in Environment Variables');
        setIsRunning(false);
        return;
      }
      
      try {
        JSON.parse(formData.bodyTemplate);
      } catch (e) {
        alert('Invalid JSON in Request Body Template');
        setIsRunning(false);
        return;
      }
      
      const hasManualQuestions = formData.questionsManual.trim().length > 0;
      const mode = hasManualQuestions ? 'manual' : 'generate';
      
      const inputs = {
        mode: mode,
        old_api: formData.oldApi.trim(),
        new_api: formData.newApi.trim(),
        env: formData.envVars,
        body_template: formData.bodyTemplate,
        response_path: formData.responsePath,
        n_cases: Math.max(parseInt(formData.numCases) || 3, 10),
        goal: formData.goal,
        old_prompt: formData.oldPrompt,
        new_prompt: formData.newPrompt,
        manual_questions: hasManualQuestions
          ? formData.questionsManual.split('\n').filter(q => q.trim())
          : []
      };
      
      console.log('Sending deep dive inputs:', inputs);
      await onDeepDive(inputs);
    } catch (error) {
      alert(`Deep dive failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleQuickQuestion = () => {
    const questions = [
      'What is Indian income tax slab for FY 2024-25?',
      'How to file ITR for salaried employees?',
      'What are the deductions available under Section 80C?',
      'Explain capital gains tax in India.',
      'What is the difference between old and new tax regime?'
    ].join('\n');
    
    handleInputChange('questionsManual', questions);
    setActiveTab('manual');
  };

  const forceRefreshPremium = () => {
    localStorage.removeItem('premium_status');
    window.location.reload();
  };

  // Determine premium status for display
  const showPremiumUI = isPremium;

  return (
    <div className="setup-panel">
      <div className="panel-header">
        <div className="panel-header-top">
          <h2>Evaluation Setup</h2>
          <div className="premium-status-display">
            {premiumLoading ? (
              <span className="premium-loading">Checking status...</span>
            ) : showPremiumUI ? (
              <div className="premium-badge">
                <span className="badge premium">✨ PRO</span>
                <span className="dives-count">Deep Dives: {deepDivesRemaining}</span>
              </div>
            ) : (
              <div className="free-badge">
                <span className="badge free">Free Tier</span>
                <button 
                  className="btn-link debug-btn"
                  onClick={() => setShowDebug(!showDebug)}
                  title="Debug info"
                >
                  ⚙️
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="collaboration-bar">
          <div className="team-section">
            <span className="team-label">Team</span>
            <div className="team-avatars">
              {teamMembers?.slice(0, 3).map((member, index) => (
                <div 
                  key={member.member_id || index}
                  className={`team-avatar ${member.role === 'OWNER' ? 'owner' : ''}`}
                  title={`${member.display_name || member.email} (${member.role})`}
                >
                  {(member.display_name || member.email)?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              ))}
              {teamMembers?.length > 3 && (
                <div className="team-avatar more">
                  +{teamMembers.length - 3}
                </div>
              )}
            </div>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onInvite}
            disabled={!activeCase}
          >
            Invite
          </button>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="debug-panel">
          <div className="debug-header">
            <h4>Debug Info</h4>
            <button 
              className="btn-icon"
              onClick={() => setShowDebug(false)}
            >
              ✕
            </button>
          </div>
          <div className="debug-content">
            <p><strong>Context isPremium:</strong> {isPremium.toString()}</p>
            <p><strong>Deep Dives:</strong> {deepDivesRemaining}</p>
            <p><strong>localStorage:</strong> {localStorage.getItem('premium_status') || 'none'}</p>
            <div className="debug-actions">
              <button 
                className="btn btn-sm btn-secondary"
                onClick={forceRefreshPremium}
              >
                Force Refresh
              </button>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  // Force set to pro for testing
                  const proData = {
                    tier: 'pro',
                    is_premium: true,
                    deep_dives_remaining: 5
                  };
                  localStorage.setItem('premium_status', JSON.stringify(proData));
                  window.location.reload();
                }}
              >
                Set as Pro (test)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel-content-scroll">
        <div className="panel-content">
          {/* API Configuration */}
          <div className="section">
            <h3>API Configuration</h3>
            <div className="input-grid">
              <div className="input-group">
                <label>Old API URL</label>
                <input
                  type="text"
                  value={formData.oldApi}
                  onChange={(e) => handleInputChange('oldApi', e.target.value)}
                  placeholder="https://api.example.com/v1/chat"
                  className="input-large"
                />
              </div>
              <div className="input-group">
                <label>New API URL</label>
                <input
                  type="text"
                  value={formData.newApi}
                  onChange={(e) => handleInputChange('newApi', e.target.value)}
                  placeholder="https://api.example.com/v2/chat"
                  className="input-large"
                />
              </div>
            </div>
          </div>

          {/* Request Configuration */}
          <div className="section">
            <h3>Request Configuration</h3>
            <div className="input-group">
              <label>Environment Variables (JSON)</label>
              <textarea
                value={formData.envVars}
                onChange={(e) => handleInputChange('envVars', e.target.value)}
                placeholder='{ "api_key": "your-key" }'
                rows={4}
                className="textarea-large"
              />
              <div className="input-hint">
                Use <code>{"{{question}}"}</code> for dynamic question insertion
              </div>
            </div>

            <div className="input-group">
              <label>Request Body Template (JSON)</label>
              <textarea
                value={formData.bodyTemplate}
                onChange={(e) => handleInputChange('bodyTemplate', e.target.value)}
                placeholder='{ "prompt": "{{question}}" }'
                rows={6}
                className="textarea-large"
              />
              <div className="input-hint">
                Ensure template contains <code>{"{{question}}"}</code> placeholder
              </div>
            </div>

            <div className="input-grid">
              <div className="input-group">
                <label>Response Path</label>
                <input
                  type="text"
                  value={formData.responsePath}
                  onChange={(e) => handleInputChange('responsePath', e.target.value)}
                  placeholder="choices[0].message.content"
                  className="input-large"
                />
                <div className="input-hint">
                  JSON path to extract response
                </div>
              </div>
              <div className="input-group">
                <label>Number of Test Cases</label>
                <div className="number-input-container">
                  <input
                    type="number"
                    min="1"
                    max={showPremiumUI ? "50" : "10"}
                    value={formData.numCases}
                    onChange={(e) => handleInputChange('numCases', e.target.value)}
                    className="number-input"
                  />
                  <div className="number-controls">
                    <button 
                      type="button"
                      className="number-btn"
                      onClick={() => handleInputChange('numCases', Math.max(1, parseInt(formData.numCases) - 1))}
                    >
                      −
                    </button>
                    <button 
                      type="button"
                      className="number-btn"
                      onClick={() => handleInputChange('numCases', Math.min(showPremiumUI ? 50 : 10, parseInt(formData.numCases) + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="input-hint">
                  {showPremiumUI ? 'Up to 50 cases' : 'Max 10 cases'}
                </div>
              </div>
            </div>
          </div>

          {/* System Goal & Prompts */}
          <div className="section">
            <h3>System Configuration</h3>
            <div className="input-group">
              <label>System Goal</label>
              <textarea
                value={formData.goal}
                onChange={(e) => handleInputChange('goal', e.target.value)}
                placeholder="Describe what your system should accomplish"
                rows={4}
                className="textarea-large"
              />
            </div>

            <div className="input-grid">
              <div className="input-group">
                <label>Old System Prompt</label>
                <textarea
                  value={formData.oldPrompt}
                  onChange={(e) => handleInputChange('oldPrompt', e.target.value)}
                  placeholder="Current system prompt"
                  rows={6}
                  className="textarea-large"
                />
              </div>
              <div className="input-group">
                <label>New System Prompt</label>
                <textarea
                  value={formData.newPrompt}
                  onChange={(e) => handleInputChange('newPrompt', e.target.value)}
                  placeholder="New system prompt to test"
                  rows={6}
                  className="textarea-large"
                />
              </div>
            </div>
          </div>

          {/* Test Cases */}
          <div className="section">
            <div className="section-header">
              <h3>Test Cases</h3>
              <div className="tab-buttons">
                <button
                  className={`tab-btn ${activeTab === 'auto' ? 'active' : ''}`}
                  onClick={() => setActiveTab('auto')}
                >
                  Auto-generate
                </button>
                <button
                  className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                  onClick={() => setActiveTab('manual')}
                >
                  Manual Input
                </button>
              </div>
            </div>

            {activeTab === 'auto' ? (
              <div className="auto-generate">
                <p className="hint">
                  Questions will be automatically generated based on your system goal.
                  <button 
                    className="btn-link"
                    onClick={handleQuickQuestion}
                  >
                    Use sample questions
                  </button>
                </p>
              </div>
            ) : (
              <div className="input-group">
                <label>Manual Questions (one per line)</label>
                <textarea
                  value={formData.questionsManual}
                  onChange={(e) => handleInputChange('questionsManual', e.target.value)}
                  placeholder="Enter test questions, one per line"
                  rows={8}
                  className="textarea-extra-large"
                />
                <div className="input-hint">
                  {formData.questionsManual.split('\n').filter(q => q.trim()).length} questions entered
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="action-bar">
            <button
              className={`btn btn-primary ${isRunning ? 'loading' : ''}`}
              onClick={handleRunAnalysis}
              disabled={isRunning || !activeCase}
            >
              {isRunning ? (
                <>
                  <span className="spinner"></span>
                  Running Analysis...
                </>
              ) : (
                '⚡ Run Analysis'
              )}
            </button>

            {showPremiumUI ? (
              <button
                className={`btn btn-premium ${isRunning ? 'loading' : ''}`}
                onClick={handleDeepDive}
                disabled={isRunning || !activeCase || deepDivesRemaining <= 0}
              >
                {isRunning ? (
                  <>
                    <span className="spinner"></span>
                    Running Deep Dive...
                  </>
                ) : (
                  `🔬 Deep Dive (${deepDivesRemaining} left)`
                )}
              </button>
            ) : (
              <div className="premium-upsell">
                <p>
                  Need deeper analysis? 
                  <button 
                    className="btn-link"
                    onClick={() => window.location.hash = '#pricing'}
                  >
                    Upgrade to Premium
                  </button>
                </p>
              </div>
            )}

            <span className="action-hint">
              Any change creates a new version
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPanel;