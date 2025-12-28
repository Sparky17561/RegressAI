import { useState } from 'react';
import PricingModal from './Modals/PricingModal';
import { usePremium } from '../contexts/PremiumContext';
import './Sidebar.css';

const Sidebar = ({
  cases,
  activeCase,
  versions,
  selectedVersion,
  onCreateCase,
  onSelectCase,
  onSelectVersion
}) => {
  const [expandedCase, setExpandedCase] = useState(activeCase?.case_id || null);
  const [showPricing, setShowPricing] = useState(false);
  
  // ✅ Get premium status from context
  const { is_premium, deep_dives_remaining } = usePremium();

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

  const handleRenameCase = (caseItem, e) => {
    e.stopPropagation();
    const newName = prompt('Rename case:', caseItem.name);
    if (newName && newName.trim() !== caseItem.name) {
      // Call your update case function here
      console.log('Rename case:', caseItem.case_id, 'to', newName);
    }
  };

  const handleDeleteCase = (caseItem, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete case "${caseItem.name}"? This action cannot be undone.`)) {
      // Call your delete case function here
      console.log('Delete case:', caseItem.case_id);
    }
  };

  const handleUpgradeSuccess = () => {
    console.log('Upgrade successful!');
    setShowPricing(false);
    // The PremiumContext will handle the state update
  };

  return (
    <>
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
                        onClick={(e) => handleRenameCase(caseItem, e)}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn-icon"
                        onClick={(e) => handleDeleteCase(caseItem, e)}
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
                        versions.map((version) => {
                          // 🔥 CRITICAL FIX: Check for deep dive flag
                          const isDeepDive = version.is_deep_dive || false;
                          
                          return (
                            <div
                              key={version.version_id}
                              className={`version-item ${selectedVersion?.version_id === version.version_id ? 'active' : ''}`}
                              onClick={() => onSelectVersion(version)}
                            >
                              <div className="version-header">
                                <div className="version-info">
                                  <span className="version-number">
                                    v{version.version_number}
                                    {isDeepDive && (
                                      <span className="badge deep-dive-small">🔬</span>
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
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          {/* ✅ Use is_premium from context */}
          {is_premium ? (
            <div className="premium-badge">
              <span className="badge premium">✨ PRO</span>
              <span className="premium-info">
                Deep dives remaining: {deep_dives_remaining}
              </span>
            </div>
          ) : (
            <div className="free-tier">
              <p>Free Tier • Limited features</p>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPricing(true)}
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Pricing Modal */}
      <PricingModal 
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        onUpgrade={handleUpgradeSuccess}
      />
    </>
  );
};

export default Sidebar;