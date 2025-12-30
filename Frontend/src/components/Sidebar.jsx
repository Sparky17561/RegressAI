import { useState } from 'react';
import { 
  BrainCircuit, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Microscope,
  Box
} from 'lucide-react';
import PricingModal from './Modals/PricingModal';
import NewCaseModal from './Modals/NewCaseModal'; // Import the new modal
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
  
  // Modal States
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseModalMode, setCaseModalMode] = useState('create');
  const [caseToRename, setCaseToRename] = useState(null);
  
  const { is_premium, deep_dives_remaining } = usePremium();

  // --- Handlers ---

  const openCreateModal = () => {
    setCaseModalMode('create');
    setCaseToRename(null);
    setIsCaseModalOpen(true);
  };

  const openRenameModal = (caseItem, e) => {
    e.stopPropagation();
    setCaseModalMode('rename');
    setCaseToRename(caseItem);
    setIsCaseModalOpen(true);
  };

  const handleModalSubmit = (name) => {
    if (caseModalMode === 'create') {
      onCreateCase(name);
    } else if (caseModalMode === 'rename' && caseToRename) {
      if (name !== caseToRename.name) {
        // In a real app, you'd call an update function here
        console.log('Rename case:', caseToRename.case_id, 'to', name);
        // Optimistic update or callback could go here
      }
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

  const handleDeleteCase = (caseItem, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete case "${caseItem.name}"? This action cannot be undone.`)) {
      console.log('Delete case:', caseItem.case_id);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'danger';
    if (score >= 40) return 'warning';
    return 'safe';
  };

  return (
    <>
      <aside className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="brand">
            <div className="logo-icon-wrapper">
              <BrainCircuit className="logo-icon" size={24} />
            </div>
            <div className="brand-text">
              <h2>RegressAI</h2>
              <span className="brand-version">v1.0</span>
            </div>
          </div>
          <button 
            className="btn-new-case"
            onClick={openCreateModal}
          >
            <Plus size={16} />
            New Case
          </button>
        </div>

        {/* Scrollable List */}
        <div className="cases-list-container">
          {cases.length === 0 ? (
            <div className="empty-state">
              <Box size={32} className="empty-icon" />
              <p>No cases yet</p>
              <button 
                className="btn-link"
                onClick={openCreateModal}
              >
                Create your first case
              </button>
            </div>
          ) : (
            <div className="cases-list">
              <div className="list-title">MY WORKSPACE</div>
              {cases.map((caseItem) => {
                const isActive = activeCase?.case_id === caseItem.case_id;
                const isExpanded = expandedCase === caseItem.case_id;

                return (
                  <div 
                    key={caseItem.case_id}
                    className={`case-item ${isActive ? 'active' : ''}`}
                  >
                    <div 
                      className="case-row"
                      onClick={() => handleCaseClick(caseItem)}
                    >
                      <span className="case-icon">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="case-name">{caseItem.name}</span>
                      
                      <div className="case-actions">
                        <button 
                          className="action-btn"
                          onClick={(e) => openRenameModal(caseItem, e)}
                          title="Rename"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          className="action-btn danger"
                          onClick={(e) => handleDeleteCase(caseItem, e)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Versions Sub-list */}
                    {isExpanded && (
                      <div className="versions-list">
                        {versions.length === 0 ? (
                          <div className="empty-versions">No versions</div>
                        ) : (
                          versions.map((version) => {
                            const isSelected = selectedVersion?.version_id === version.version_id;
                            const isDeepDive = version.is_deep_dive || false;

                            return (
                              <div
                                key={version.version_id}
                                className={`version-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => onSelectVersion(version)}
                              >
                                <div className="version-left">
                                  {isDeepDive ? (
                                    <Microscope size={14} className="icon-deep-dive" />
                                  ) : (
                                    <FileText size={14} className="icon-file" />
                                  )}
                                  <span className="v-num">v{version.version_number}</span>
                                </div>
                                <div className="version-right">
                                  <span className={`score-dot ${getScoreColor(version.cookedness_score || 0)}`}></span>
                                  <span className="v-date">{formatDate(version.created_at)}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          {is_premium ? (
            <div className="premium-card">
              <div className="premium-header">
                <span className="badge-pro">PRO PLAN</span>
              </div>
              <div className="premium-stats">
                <div className="stat-row">
                  <span>Deep Dives</span>
                  <span className="stat-val">{deep_dives_remaining}</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-fill" style={{ width: `${(deep_dives_remaining/5)*100}%` }}></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="free-card">
              <div className="free-content">
                <strong>Free Plan</strong>
                <p>Upgrade for Deep Dives</p>
              </div>
              <button 
                className="btn-upgrade"
                onClick={() => setShowPricing(true)}
              >
                Upgrade
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Modals */}
      <PricingModal 
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        onUpgrade={() => setShowPricing(false)}
      />

      <NewCaseModal
        isOpen={isCaseModalOpen}
        onClose={() => setIsCaseModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialName={caseModalMode === 'rename' ? caseToRename?.name : ''}
        mode={caseModalMode}
      />
    </>
  );
};

export default Sidebar;
