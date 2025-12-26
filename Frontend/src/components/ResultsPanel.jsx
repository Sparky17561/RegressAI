import { useState } from 'react';
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

  const tabs = [
    { id: 'summary', label: '📊 Summary', premium: false },
    { id: 'diff', label: '🔍 Diff', premium: false },
    { id: 'insights', label: '💡 Insights', premium: false },
    { id: 'visualizations', label: '📈 Visualizations', premium: true },
    { id: 'snapshot', label: '📸 Snapshot', premium: false }
  ];

  const formatJSON = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
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

    const { evaluation, scores, verdict } = selectedVersion;
    const deterministic = evaluation?.deterministic || {};
    const llmJudge = evaluation?.llm_judge || {};

    return (
      <div className="summary-content">
        {/* Verdict Banner */}
        <div className={`verdict-banner verdict-${verdict?.final?.toLowerCase() || 'unknown'}`}>
          <div className="verdict-header">
            <h3>Final Verdict: {verdict?.final || 'Unknown'}</h3>
            <div className="cookedness-score">
              <span className="score-label">Cookedness</span>
              <span className="score-value">{scores?.cookedness?.cookedness_score || 0}</span>
            </div>
          </div>
          <p className="verdict-reason">{verdict?.reason || llmJudge?.summary || 'No summary available'}</p>
          <div className="verdict-tags">
            {verdict?.ship_recommendation && (
              <span className={`tag ${verdict.ship_recommendation.toLowerCase().replace('_', '-')}`}>
                {verdict.ship_recommendation.replace('_', ' ')}
              </span>
            )}
            {selectedVersion.is_deep_dive && (
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
                {scores?.deterministic_score || 0}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill"
                style={{ width: `${scores?.deterministic_score || 0}%` }}
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
                {deterministic?.deterministic_score || 0}
              </span>
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill"
                style={{ width: `${deterministic?.deterministic_score || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Test Cases</span>
              <span className="metric-value">
                {selectedVersion.test_cases?.length || 0}
              </span>
            </div>
            <p className="metric-subtitle">Processed</p>
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
            {comments.length === 0 ? (
              <div className="empty-comments">
                <p>No comments yet</p>
              </div>
            ) : (
              comments.map((comment) => (
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
    if (!selectedVersion?.results) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No Diff Available</h3>
          <p>Run an analysis to see side-by-side comparison</p>
        </div>
      );
    }

    const { old = [], new: newResults = [] } = selectedVersion.results;
    
    return (
      <div className="diff-content">
        <h3>Deterministic Diff</h3>
        <div className="diff-grid">
          <div className="diff-column">
            <div className="diff-header">
              <h4>Old Output</h4>
              <span className="diff-count">{old.length} responses</span>
            </div>
            <div className="diff-samples">
              {old.slice(0, 3).map((result, index) => (
                <div key={index} className="diff-sample">
                  <pre>{formatJSON(result.response)}</pre>
                </div>
              ))}
            </div>
          </div>
          
          <div className="diff-column">
            <div className="diff-header">
              <h4>New Output</h4>
              <span className="diff-count">{newResults.length} responses</span>
            </div>
            <div className="diff-samples">
              {newResults.slice(0, 3).map((result, index) => (
                <div key={index} className="diff-sample">
                  <pre>{formatJSON(result.response)}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    if (!selectedVersion?.evaluation?.llm_judge) {
      return (
        <div className="empty-state">
          <div className="empty-icon">💡</div>
          <h3>No Insights Available</h3>
          <p>Run an analysis to see AI-powered insights</p>
        </div>
      );
    }

    const llmJudge = selectedVersion.evaluation.llm_judge;

    return (
      <div className="insights-content">
        {/* Change Type */}
        {llmJudge.change_type && (
          <div className="insight-section">
            <h4>Change Type: {llmJudge.change_type}</h4>
            <p className="insight-summary">{llmJudge.summary}</p>
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

        {/* Suggestions */}
        {llmJudge.suggestions?.length > 0 && (
          <div className="insight-section">
            <h4>Suggestions</h4>
            <div className="suggestions-grid">
              {llmJudge.suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-card">
                  <div className="suggestion-header">
                    <span className="suggestion-scope">{suggestion.scope}</span>
                    <span className={`suggestion-severity ${suggestion.severity?.toLowerCase()}`}>
                      {suggestion.severity}
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
            <textarea
              className="revised-prompt"
              value={llmJudge.revised_prompt}
              readOnly
              rows={6}
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
        return <Visualizations version={selectedVersion} isPremium={isPremium} />;
      case 'snapshot':
        return renderSnapshot();
      default:
        return renderSummary();
    }
  };

  return (
    <div className="results-panel">
      {/* Tab Navigation */}
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

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>

      {/* Team Members Sidebar */}
      <div className="team-sidebar">
        <h4>Team Members</h4>
        // In the team-list section (around line 425):
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