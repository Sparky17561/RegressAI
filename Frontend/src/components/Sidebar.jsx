import { useState } from 'react';
import './Sidebar.css';

const Sidebar = ({
  cases,
  activeCase,
  versions,
  selectedVersion,
  onCreateCase,
  onSelectCase,
  onSelectVersion,
  isPremium
}) => {
  const [expandedCase, setExpandedCase] = useState(activeCase?.case_id || null);

  const handleCreateCase = () => {
    const name = prompt('Enter case name:');
    if (name) {
      onCreateCase(name);
    }
  };

  const handleCaseClick = (caseItem) => {
    if (expandedCase === caseItem.case_id) {
      setExpandedCase(null);
    } else {
      setExpandedCase(caseItem.case_id);
      onSelectCase(caseItem.case_id);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'danger';
    if (score >= 40) return 'warning';
    return 'safe';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="logo">
            <div className="logo-icon">🧠</div>
            <div className="logo-text">
              <h2>RegressAI</h2>
              <p className="subtitle">Version Control for LLMs</p>
            </div>
          </div>
          <button 
            className="btn btn-primary btn-new-case"
            onClick={handleCreateCase}
          >
            + New Case
          </button>
        </div>
      </div>

      <div className="cases-list">
        {cases.length === 0 ? (
          <div className="empty-state">
            <p>No cases yet</p>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleCreateCase}
            >
              + Create First Case
            </button>
          </div>
        ) : (
          <div className="cases-container">
            {cases.map((caseItem) => (
              <div 
                key={caseItem.case_id}
                className={`case-item ${activeCase?.case_id === caseItem.case_id ? 'active' : ''}`}
              >
                <div 
                  className="case-header"
                  onClick={() => handleCaseClick(caseItem)}
                >
                  <div className="case-main">
                    <span className={`expand-icon ${expandedCase === caseItem.case_id ? 'expanded' : ''}`}>
                      ▶
                    </span>
                    <div className="case-info">
                      <h3 className="case-name">{caseItem.name}</h3>
                      <p className="case-meta">
                        {caseItem.version_count || 0} version{caseItem.version_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="case-actions">
                    <button 
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newName = prompt('Rename case:', caseItem.name);
                        if (newName) {
                          // Handle rename
                        }
                      }}
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this case?')) {
                          // Handle delete
                        }
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {expandedCase === caseItem.case_id && (
                  <div className="versions-list">
                    {versions.length === 0 ? (
                      <div className="empty-versions">
                        <p>No versions yet</p>
                      </div>
                    ) : (
                      versions.map((version) => (
                        <div
                          key={version.version_id}
                          className={`version-item ${selectedVersion?.version_id === version.version_id ? 'active' : ''}`}
                          onClick={() => onSelectVersion(version)}
                        >
                          <div className="version-header">
                            <div className="version-info">
                              <span className="version-number">
                                v{version.version_number}
                                {version.is_deep_dive && (
                                  <span className="badge deep-dive">🔬</span>
                                )}
                              </span>
                              <span className="version-date">
                                {formatDate(version.created_at)}
                              </span>
                            </div>
                            <div className={`score score-${getScoreColor(version.cookedness_score || 0)}`}>
                              {version.cookedness_score || 0}
                            </div>
                          </div>
                          <div className="version-meta">
                            <span className="verdict">{version.verdict || 'Unknown'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        {isPremium ? (
          <div className="premium-badge">
            <span className="badge premium">✨ PRO</span>
            <span className="premium-info">
              Unlimited analysis • Deep dive access
            </span>
          </div>
        ) : (
          <div className="free-tier">
            <p>Free Tier • Limited features</p>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => window.location.hash = '#pricing'}
            >
              Upgrade
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;