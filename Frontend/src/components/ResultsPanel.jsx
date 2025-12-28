import { useState, useEffect, useMemo } from 'react';
import Visualizations from './Visualizations';
import './ResultsPanel.css';

const ResultsPanel = ({
  selectedVersion,
  comments,
  teamMembers,
  onAddComment,
  isPremium
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [newComment, setNewComment] = useState('');

  // 🔥 ROBUST CHECK: Is this version a deep dive?
  const isDeepDive = useMemo(() => {
    if (!selectedVersion) return false;
    
    const analysisResponse = selectedVersion.analysis_response || selectedVersion || {};
    
    // Primary check: is_deep_dive flag at root
    if (selectedVersion.is_deep_dive === true) return true;
    
    // Secondary check: is_deep_dive in analysis_response
    if (analysisResponse.is_deep_dive === true) return true;
    
    // Fallback 1: Check for deep_dive_metrics
    if (analysisResponse.deep_dive_metrics && Object.keys(analysisResponse.deep_dive_metrics).length > 0) {
      return true;
    }
    
    // Fallback 2: Check for visualization_data
    if (analysisResponse.visualization_data && Object.keys(analysisResponse.visualization_data).length > 0) {
      return true;
    }
    
    return false;
  }, [selectedVersion]);

  // 🔥 DYNAMIC TABS: Only show visualizations tab for deep dive versions
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'summary', label: '📊 Summary', premium: false },
      { id: 'diff', label: '🔍 Diff', premium: false },
      { id: 'insights', label: '💡 Insights', premium: false }
    ];
    
    // Only add visualizations tab if it's a deep dive AND user is premium
    if (isDeepDive && isPremium) {
      baseTabs.push({ id: 'visualizations', label: '📈 Visualizations', premium: true });
    }
    
    baseTabs.push({ id: 'snapshot', label: '📸 Snapshot', premium: false });
    
    return baseTabs;
  }, [isDeepDive, isPremium]);

  // 🔥 AUTO-SWITCH: If current tab is visualizations but version changed to non-deep-dive, switch to summary
  useEffect(() => {
    if (activeTab === 'visualizations' && (!isDeepDive || !isPremium)) {
      setActiveTab('summary');
    }
  }, [isDeepDive, isPremium, activeTab]);

  // 🔥 RESET TAB: When version changes, go back to summary
  useEffect(() => {
    if (selectedVersion) {
      setActiveTab('summary');
    }
  }, [selectedVersion?.version_id]);

  const formatJSON = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // 🔥 HELPER: Check if response is valid (not broken/echoing)
  const isValidResponse = (response) => {
    if (!response || typeof response !== 'string') return false;
    if (response.length < 100) return false; // Increased minimum length
    
    // Check for common broken response patterns
    const brokenPatterns = [
      "I'll follow the strict rules",
      "I'll provide information",
      "Please go ahead and ask",
      "Please proceed with your question",
      "I'm ready when you are",
      "User Question:",
      "{question}"
    ];
    
    const lowerResponse = response.toLowerCase();
    for (const pattern of brokenPatterns) {
      if (lowerResponse.includes(pattern.toLowerCase())) {
        return false;
      }
    }
    
    // Check if response is mostly just the prompt template
    const hasActualContent = response.includes("Assumptions:") && 
                            (response.includes("Explanation:") || response.includes("High-Level Explanation:"));
    
    // If it has the structure but is too short, it's likely broken
    if (hasActualContent && response.length < 300) {
      return false;
    }
    
    return true;
  };

  const renderSummary = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Analysis Results</h3>
          <p>Run an analysis to see results here</p>
        </div>
      );
    }

    // Extract data from correct location
    const analysisResponse = selectedVersion.analysis_response || selectedVersion;
    const evaluation = analysisResponse?.evaluation || {};
    const scores = analysisResponse?.scores || {};
    const verdict = analysisResponse?.verdict || {};
    const testCases = analysisResponse?.test_cases || [];
    const deterministic = evaluation?.deterministic || {};
    const llmJudge = evaluation?.llm_judge || {};
    
    // 🔥 CHECK FOR BROKEN RESPONSES
    const results = analysisResponse?.results || {};
    const newResults = results.new || [];
    const brokenResponses = newResults.filter(r => !isValidResponse(r.response)).length;
    const hasBrokenResponses = brokenResponses > 0;

    return (
      <div className="summary-content">
        {/* 🔥 WARNING BANNER for broken responses */}
        {hasBrokenResponses && (
          <div className="verdict-banner" style={{
            backgroundColor: '#fff3cd',
            borderColor: '#ffc107',
            borderWidth: '2px',
            borderStyle: 'solid',
            marginBottom: '1.5rem',
            padding: '1.5rem'
          }}>
            <div className="verdict-header">
              <h3 style={{ color: '#856404', marginBottom: '0.5rem' }}>
                ⚠️ Prompt Configuration Issue Detected
              </h3>
            </div>
            <p style={{ color: '#856404', marginBottom: '1rem', lineHeight: '1.6' }}>
              <strong>{brokenResponses} out of {newResults.length} responses are invalid.</strong> 
              {' '}Your new prompt appears to be echoing instructions instead of answering questions. 
              This happens when the prompt includes placeholders like <code>User Question: {'{question}'}</code> 
              that aren't being replaced by the actual question.
            </p>
            <p style={{ color: '#856404', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <strong>💡 How to fix:</strong> Remove any <code>{'{question}'}</code> placeholders from your prompt. 
              The question is automatically injected via the Body Template field - your prompt should only contain 
              system instructions.
            </p>
            <div className="verdict-tags">
              <span style={{
                backgroundColor: '#ffc107',
                color: '#000',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}>
                PROMPT ERROR
              </span>
              <span style={{
                backgroundColor: '#dc3545',
                color: '#fff',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                marginLeft: '0.5rem'
              }}>
                ANALYSIS COMPROMISED
              </span>
            </div>
          </div>
        )}

        {/* Verdict Banner */}
        <div className={`verdict-banner verdict-${verdict?.final?.toLowerCase() || 'unknown'}`}>
          <div className="verdict-header">
            <h3>Final Verdict: {verdict?.final || 'Unknown'}</h3>
            <div className="cookedness-score">
              <span className="score-label">Cookedness</span>
              <span className="score-value">
                {scores?.cookedness?.cookedness_score || scores?.cookedness?.score || 0}
              </span>
            </div>
          </div>
          <p className="verdict-reason">{verdict?.reason || llmJudge?.summary || 'No summary available'}</p>
          <div className="verdict-tags">
            {verdict?.ship_recommendation && (
              <span className={`tag ${verdict.ship_recommendation.toLowerCase().replace('_', '-')}`}>
                {verdict.ship_recommendation.replace('_', ' ')}
              </span>
            )}
            {isDeepDive && (
              <span className="tag deep-dive">🔬 Deep Dive Analysis</span>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Quality Score</span>
              <span className="metric-value">
                {scores?.quality_score || scores?.deterministic_score || 0}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill"
                style={{ width: `${scores?.quality_score || scores?.deterministic_score || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Safety Score</span>
              <span className="metric-value">
                {scores?.safety_score || 0}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill safety"
                style={{ width: `${scores?.safety_score || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Deterministic Score</span>
              <span className="metric-value">
                {deterministic?.deterministic_score || scores?.deterministic_score || 0}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill"
                style={{ width: `${deterministic?.deterministic_score || scores?.deterministic_score || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Test Cases</span>
              <span className="metric-value">
                {testCases?.length || 0}
              </span>
            </div>
            <p className="metric-subtitle">
              {hasBrokenResponses && `${brokenResponses} broken`}
            </p>
          </div>
        </div>

        {/* Deterministic Flags */}
        {deterministic?.deterministic_flags?.length > 0 && (
          <div className="flags-section">
            <h4>Detected Changes</h4>
            <div className="flags-grid">
              {deterministic.deterministic_flags.map((flag, index) => (
                <div key={index} className="flag-item">
                  <span className="flag-icon">⚠️</span>
                  <span className="flag-text">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="comments-section">
          <h4>Comments</h4>
          <div className="comments-list">
            {comments?.length === 0 ? (
              <div className="empty-comments">
                <p>No comments yet</p>
              </div>
            ) : (
              comments?.map((comment) => (
                <div key={comment.comment_id} className="comment">
                  <div className="comment-header">
                    <div className="comment-author">
                      <div className="author-avatar">
                        {comment.user_name?.charAt(0) || comment.user_email?.charAt(0) || 'U'}
                      </div>
                      <div className="author-info">
                        <strong>{comment.user_name || comment.user_email}</strong>
                        <span className="comment-time">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="comment-body">
                    {comment.text}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="comment-input">
            <textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                if (newComment.trim()) {
                  onAddComment(newComment);
                  setNewComment('');
                }
              }}
              disabled={!newComment.trim()}
            >
              Post Comment
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiff = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No Diff Available</h3>
          <p>Run an analysis to see side-by-side comparison</p>
        </div>
      );
    }

    const analysisResponse = selectedVersion.analysis_response || selectedVersion;
    const results = analysisResponse?.results || {};
    const { old = [], new: newResults = [] } = results;
    
    // Count broken responses
    const brokenCount = newResults.filter(r => !isValidResponse(r.response)).length;
    
    return (
      <div className="diff-content">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h3>Deterministic Diff</h3>
          {brokenCount > 0 && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
              color: '#856404'
            }}>
              ⚠️ {brokenCount} broken response{brokenCount !== 1 ? 's' : ''} detected
            </div>
          )}
        </div>
        
        <div className="diff-grid">
          <div className="diff-column">
            <div className="diff-header">
              <h4>Old Output</h4>
              <span className="diff-count">{old.length} responses</span>
            </div>
            <div className="diff-samples" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {old.map((result, index) => (
                <div key={index} className="diff-sample" style={{ marginBottom: '1.5rem' }}>
                  <div className="question-label" style={{ 
                    fontWeight: '600', 
                    marginBottom: '0.5rem',
                    color: '#495057'
                  }}>
                    Test Case {index + 1}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#6c757d',
                    marginBottom: '0.5rem',
                    fontStyle: 'italic'
                  }}>
                    Q: {result.question}
                  </div>
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{
                      cursor: 'pointer',
                      padding: '0.5rem',
                      backgroundColor: '#e9ecef',
                      borderRadius: '0.25rem',
                      fontWeight: '500',
                      userSelect: 'none'
                    }}>
                      View Response ({result.response?.length || 0} chars)
                    </summary>
                    <pre style={{ 
                      maxHeight: '400px', 
                      overflow: 'auto',
                      fontSize: '0.85rem',
                      backgroundColor: '#f8f9fa',
                      padding: '0.75rem',
                      marginTop: '0.5rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: '1px solid #dee2e6',
                      borderRadius: '0.25rem'
                    }}>
                      {result.response}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
          
          <div className="diff-column">
            <div className="diff-header">
              <h4>New Output</h4>
              <span className="diff-count">{newResults.length} responses</span>
            </div>
            <div className="diff-samples" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {newResults.map((result, index) => {
                const isBroken = !isValidResponse(result.response);
                return (
                  <div key={index} className="diff-sample" style={{
                    borderLeft: isBroken ? '4px solid #ffc107' : '4px solid transparent',
                    paddingLeft: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <div className="question-label" style={{ 
                        fontWeight: '600',
                        color: '#495057'
                      }}>
                        Test Case {index + 1}
                      </div>
                      {isBroken && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#ffc107',
                          color: '#000',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          ⚠️ BROKEN
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#6c757d',
                      marginBottom: '0.5rem',
                      fontStyle: 'italic'
                    }}>
                      Q: {result.question}
                    </div>
                    <details style={{ marginTop: '0.5rem' }}>
                      <summary style={{
                        cursor: 'pointer',
                        padding: '0.5rem',
                        backgroundColor: isBroken ? '#fff3cd' : '#e9ecef',
                        borderRadius: '0.25rem',
                        fontWeight: '500',
                        userSelect: 'none'
                      }}>
                        View Response ({result.response?.length || 0} chars)
                      </summary>
                      <pre style={{ 
                        maxHeight: '400px', 
                        overflow: 'auto',
                        fontSize: '0.85rem',
                        backgroundColor: isBroken ? '#fff3cd' : '#f8f9fa',
                        padding: '0.75rem',
                        marginTop: '0.5rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        border: `1px solid ${isBroken ? '#ffc107' : '#dee2e6'}`,
                        borderRadius: '0.25rem'
                      }}>
                        {result.response}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {brokenCount > 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '0.5rem'
          }}>
            <p style={{ 
              color: '#856404', 
              marginBottom: '0.75rem', 
              fontWeight: '600',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1.25rem' }}>💡</span>
              Why are responses broken?
            </p>
            <p style={{ 
              color: '#856404', 
              fontSize: '0.95rem', 
              lineHeight: '1.6',
              margin: 0 
            }}>
              Your new prompt contains a placeholder like{' '}
              <code style={{
                backgroundColor: '#ffc107',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                fontSize: '0.9em',
                fontWeight: '600',
                color: '#000'
              }}>
                User Question: {'{question}'}
              </code>
              {' '}that isn't being replaced. Remove this from your prompt - questions are automatically 
              injected via the Body Template configuration.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderInsights = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No Insights Available</h3>
          <p>Run an analysis to see AI-powered insights</p>
        </div>
      );
    }

    const analysisResponse = selectedVersion.analysis_response || selectedVersion;
    const evaluation = analysisResponse?.evaluation || {};
    const llmJudge = evaluation?.llm_judge || {};
    
    // Check if responses were broken
    const results = analysisResponse?.results || {};
    const newResults = results.new || [];
    const brokenCount = newResults.filter(r => !isValidResponse(r.response)).length;
    const hasBrokenResponses = brokenCount > 0;

    if (!llmJudge || Object.keys(llmJudge).length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No Insights Available</h3>
          <p>LLM analysis not available for this version</p>
        </div>
      );
    }

    return (
      <div className="insights-content">
        {/* Warning if responses were broken */}
        {hasBrokenResponses && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: '#856404', fontWeight: '600', marginBottom: '0.5rem' }}>
              ⚠️ Analysis Quality Warning
            </p>
            <p style={{ color: '#856404', fontSize: '0.9rem', margin: 0 }}>
              {brokenCount} out of {newResults.length} responses were broken. The insights below 
              are based on incomplete data and may not be accurate. Fix your prompt configuration 
              and run the analysis again.
            </p>
          </div>
        )}

        {/* Change Type */}
        {llmJudge.change_type && (
          <div className="insight-section">
            <h4>Change Type: {llmJudge.change_type}</h4>
            <p className="insight-summary">{llmJudge.summary || llmJudge.change_summary}</p>
          </div>
        )}

        {/* Findings */}
        {llmJudge.findings?.length > 0 && (
          <div className="insight-section">
            <h4>Key Findings</h4>
            <ul className="insight-list">
              {llmJudge.findings.map((finding, index) => (
                <li key={index}>{finding}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Root Causes */}
        {llmJudge.root_causes?.length > 0 && (
          <div className="insight-section">
            <h4>Root Causes</h4>
            <ul className="insight-list">
              {llmJudge.root_causes.map((cause, index) => (
                <li key={index}>{cause}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {llmJudge.suggestions?.length > 0 && (
          <div className="insight-section">
            <h4>Suggestions</h4>
            <div className="suggestions-grid">
              {llmJudge.suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card">
                  <div className="suggestion-header">
                    <span className="suggestion-scope">{suggestion.scope || 'general'}</span>
                    <span className={`suggestion-severity ${(suggestion.severity || 'medium').toLowerCase()}`}>
                      {suggestion.severity || 'medium'}
                    </span>
                  </div>
                  <p className="suggestion-explanation">{suggestion.explanation}</p>
                  {suggestion.suggested_text && (
                    <pre className="suggestion-code">{suggestion.suggested_text}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revised Prompt */}
        {llmJudge.revised_prompt && (
          <div className="insight-section">
            <h4>Revised Prompt</h4>
            {hasBrokenResponses && (
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#856404',
                backgroundColor: '#fff3cd',
                padding: '0.5rem',
                borderRadius: '0.25rem',
                marginBottom: '0.75rem'
              }}>
                💡 This revised prompt was generated based on broken responses. Test it carefully.
              </p>
            )}
            <textarea
              className="revised-prompt"
              value={llmJudge.revised_prompt}
              readOnly
              rows={10}
            />
          </div>
        )}

        {/* Quick Tests */}
        {llmJudge.quick_tests?.length > 0 && (
          <div className="insight-section">
            <h4>Quick Tests</h4>
            <ul className="insight-list">
              {llmJudge.quick_tests.map((test, index) => (
                <li key={index}>{test}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Metrics to Watch */}
        {llmJudge.metrics_to_watch?.length > 0 && (
          <div className="insight-section">
            <h4>Metrics to Watch</h4>
            <div className="metrics-grid-small">
              {llmJudge.metrics_to_watch.map((metric, index) => (
                <div key={index} className="metric-chip">
                  {metric}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Flags */}
        {llmJudge.risk_flags?.length > 0 && (
          <div className="insight-section">
            <h4>Risk Flags</h4>
            <div className="flags-grid">
              {llmJudge.risk_flags.map((flag, index) => (
                <div key={index} className="flag-item">
                  <span className="flag-icon">⚠️</span>
                  <span className="flag-text">{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSnapshot = () => {
    if (!selectedVersion) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📸</div>
          <h3>No Snapshot Available</h3>
          <p>Select a version to see its raw data</p>
        </div>
      );
    }

    return (
      <div className="snapshot-content">
        <h3>Raw JSON Snapshot</h3>
        <div className="json-viewer">
          <pre>{formatJSON(selectedVersion)}</pre>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummary();
      case 'diff':
        return renderDiff();
      case 'insights':
        return renderInsights();
      case 'visualizations':
        if (!isDeepDive || !isPremium) {
          return (
            <div className="empty-state">
              <div className="empty-icon">🔬</div>
              <h3>Not a Deep Dive Analysis</h3>
              <p>This version was not created with deep dive analysis. Run a deep dive to see advanced visualizations.</p>
            </div>
          );
        }
        return <Visualizations version={selectedVersion} isPremium={isPremium} />;
      case 'snapshot':
        return renderSnapshot();
      default:
        return renderSummary();
    }
  };

  return (
    <div className="results-panel">
      <div className="tab-navigation">
        <div className="tab-list">
          {tabs.map((tab) => {
            if (tab.premium && !isPremium) return null;
            
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.premium && <span className="badge premium">PRO</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>

      <div className="team-sidebar">
        <h4>Team Members</h4>
        <div className="team-list">
          {teamMembers?.length === 0 ? (
            <div className="empty-team">
              <p>No team members</p>
              <button className="btn btn-secondary btn-sm">
                Invite Members
              </button>
            </div>
          ) : (
            teamMembers?.map((member) => (
              <div key={member.member_id} className="team-member">
                <div className="member-avatar">
                  {(member.display_name || member.email)?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {member.display_name || member.email}
                    {member.role === 'OWNER' && (
                      <span className="badge owner">Owner</span>
                    )}
                  </div>
                  <div className="member-role">{member.role}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;