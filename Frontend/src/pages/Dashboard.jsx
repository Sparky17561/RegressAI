import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SetupPanel from '../components/SetupPanel';
import ResultsPanel from '../components/ResultsPanel';
import Notifications from '../components/Notifications';
import SettingsModal from '../components/Modals/SettingsModal';
import PricingModal from '../components/Modals/PricingModal';
import InviteModal from '../components/Modals/InviteModal';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { apiService } from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [activeCase, setActiveCase] = useState(null);
  const [cases, setCases] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { currentUser, logout } = useAuth();
  const { is_premium: isPremium, deep_dives_remaining: deepDivesRemaining, checkSubscription } = usePremium();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    loadInitialData();
    checkSubscription();
  }, [currentUser]);

  const loadInitialData = async () => {
    try {
      const [casesData, notifications] = await Promise.all([
        apiService.fetchCases(),
        apiService.fetchNotifications()
      ]);
      
      setCases(casesData.cases || []);
      
      if (casesData.cases?.length > 0) {
        const firstCase = casesData.cases[0];
        setActiveCase(firstCase);
        await loadCaseDetails(firstCase.case_id);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- loadCaseDetails ----------------------
const loadCaseDetails = async (caseId) => {
  try {
    const [caseData, members] = await Promise.all([
      apiService.fetchCase(caseId),
      apiService.fetchTeamMembers(caseId)
    ]);

    setVersions(caseData.versions || []);
    setTeamMembers(members);

    // Load the FULL most-recent version if available
    if (caseData.versions?.length > 0) {
      const latestVersionMeta = caseData.versions[0];

      // Fetch the complete, normalized version (analysis_response cleaned)
      const fullVersion = await apiService.fetchVersion(latestVersionMeta.version_id);

      console.log('📦 Loaded full version:', {
        version_id: fullVersion?.version_id,
        has_analysis_response: !!fullVersion?.analysis_response,
        is_deep_dive: fullVersion?.analysis_response?.is_deep_dive,
        has_deep_dive_metrics: !!fullVersion?.analysis_response?.deep_dive_metrics,
        has_visualization_data: !!fullVersion?.analysis_response?.visualization_data
      });

      setSelectedVersion(fullVersion);

      // Also load comments
      const commentsData = await apiService.fetchComments(fullVersion.version_id);
      setComments(commentsData.comments || []);
    } else {
      setSelectedVersion(null);
      setComments([]);
    }
  } catch (error) {
    console.error('Failed to load case details:', error);
  }
};

  const handleCreateCase = async (name) => {
    try {
      const newCase = await apiService.createCase(name);
      setCases([newCase, ...cases]);
      setActiveCase(newCase);
      await loadCaseDetails(newCase.case_id);
    } catch (error) {
      console.error('Failed to create case:', error);
    }
  };

  // ---------------------- handleRunAnalysis ----------------------
const handleRunAnalysis = async (inputs) => {
  try {
    console.log('Running analysis with inputs:', inputs);

    const payload = {
      user_id: currentUser.uid,
      case_id: activeCase?.case_id || null,
      case_name: activeCase?.name || 'Untitled Case',
      ...inputs
    };

    const result = await apiService.runAnalysis(payload);

    // Update version list from server-side case object
    const updatedCase = await apiService.fetchCase(result.case_id);
    setVersions(updatedCase.versions || []);

    // Fetch the fully normalized version and set as selected
    const fullVersion = await apiService.fetchVersion(result.version_id);
    setSelectedVersion(fullVersion);

    // Load comments for the new version
    const commentsData = await apiService.fetchComments(fullVersion.version_id);
    setComments(commentsData.comments || []);

    // Refresh cases list (keeps sidebar up-to-date)
    const casesData = await apiService.fetchCases();
    setCases(casesData.cases || []);

    return result;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
};


// Replace handleDeepDive in Dashboard.jsx with this:

// ---------------------- handleDeepDive ----------------------
const handleDeepDive = async (inputs) => {
  console.log('🔥 Dashboard handleDeepDive called');

  try {
    // Get fresh subscription status
    const freshStatus = await checkSubscription();
    console.log('Fresh subscription:', freshStatus);

    if (!freshStatus.is_premium) {
      console.log('Not premium, opening pricing modal');
      setPricingOpen(true);
      return;
    }

    if (freshStatus.deep_dives_remaining <= 0) {
      alert('No deep dives remaining this month');
      return;
    }

    const payload = {
      user_id: currentUser.uid,
      case_id: activeCase?.case_id || null,
      case_name: activeCase?.name || 'Deep Dive Analysis',
      ...inputs,
      n_cases: Math.max(inputs.n_cases || 3, 10)
    };

    const result = await apiService.runDeepDive(payload);

    console.log('✅ Deep dive completed, version_id:', result.version_id);

    // Update version list
    const updatedCase = await apiService.fetchCase(result.case_id);
    setVersions(updatedCase.versions || []);

    // Fetch normalized full deep dive version
    const fullVersion = await apiService.fetchVersion(result.version_id);

    console.log('📦 Full deep dive version loaded:', {
      version_id: fullVersion.version_id,
      is_deep_dive: fullVersion.analysis_response?.is_deep_dive,
      has_deep_dive_metrics: !!fullVersion.analysis_response?.deep_dive_metrics,
      has_visualization_data: !!fullVersion.analysis_response?.visualization_data
    });

    setSelectedVersion(fullVersion);

    // Load comments
    const commentsData = await apiService.fetchComments(fullVersion.version_id);
    setComments(commentsData.comments || []);

    // Refresh cases and subscription
    await Promise.all([
      apiService.fetchCases().then(data => setCases(data.cases || [])),
      checkSubscription()
    ]);

    return result;
  } catch (error) {
    console.error('Deep dive failed:', error);
    throw error;
  }
};

  // ---------------------- handleSelectVersion ----------------------
const handleSelectVersion = async (version) => {
  try {
    // Always fetch the full normalized version data
    const fullVersion = await apiService.fetchVersion(version.version_id);

    console.log('📦 Version selected:', {
      version_id: fullVersion.version_id,
      is_deep_dive: fullVersion.analysis_response?.is_deep_dive,
      has_deep_dive_metrics: !!fullVersion.analysis_response?.deep_dive_metrics,
      has_visualization_data: !!fullVersion.analysis_response?.visualization_data
    });

    setSelectedVersion(fullVersion);

    // Load comments for this version
    const commentsData = await apiService.fetchComments(fullVersion.version_id);
    setComments(commentsData.comments || []);
  } catch (error) {
    console.error('Failed to load version:', error);
  }
};


  const handleAddComment = async (text) => {
    if (!selectedVersion || !text.trim()) return;
    
    try {
      await apiService.addComment({
        version_id: selectedVersion.version_id,
        case_id: selectedVersion.case_id,
        text: text.trim()
      });
      
      const commentsData = await apiService.fetchComments(selectedVersion.version_id);
      setComments(commentsData.comments || []);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleInvite = async (email, role) => {
    if (!activeCase) return;
    
    try {
      await apiService.inviteMember({
        case_id: activeCase.case_id,
        invited_email: email,
        role
      });
      
      const members = await apiService.fetchTeamMembers(activeCase.case_id);
      setTeamMembers(members);
      setInviteOpen(false);
      alert('Invitation sent successfully!');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert(`Failed to send invitation: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">
          <div className="brain-logo">🧠</div>
          <p>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Top Navigation Bar */}
      <nav className="top-nav">
        <div className="nav-left">
          <button
            className="notifications-btn"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            🔔
            <span className="notification-badge">3</span>
          </button>
          <div className="user-info">
            <div className="user-avatar">
              {currentUser?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="user-email">{currentUser?.email}</span>
          </div>
        </div>
        <div className="nav-right">
          {isPremium && (
            <div className="premium-indicator">
              <span className="badge premium">✨ PRO</span>
              <span className="deep-dives">{deepDivesRemaining} deep dives left</span>
            </div>
          )}
          <button className="btn btn-secondary" onClick={() => setSettingsOpen(true)}>
            ⚙️ Settings
          </button>
          <button className="btn btn-danger" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="dashboard-content">
        <Sidebar
          cases={cases}
          activeCase={activeCase}
          versions={versions}
          selectedVersion={selectedVersion}
          onCreateCase={handleCreateCase}
          onSelectCase={loadCaseDetails}
          onSelectVersion={handleSelectVersion}
        />

        <div className="main-panel">
          <SetupPanel
            activeCase={activeCase}
            selectedVersion={selectedVersion}
            onRunAnalysis={handleRunAnalysis}
            onDeepDive={handleDeepDive}
            onInvite={() => setInviteOpen(true)}
            teamMembers={teamMembers}
          />

          <ResultsPanel
            selectedVersion={selectedVersion}
            comments={comments}
            teamMembers={teamMembers}
            onAddComment={handleAddComment}
            isPremium={isPremium}
          />
        </div>
      </div>

      {/* Modals */}
      {notificationsOpen && (
        <Notifications onClose={() => setNotificationsOpen(false)} />
      )}
      
      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          isPremium={isPremium}
        />
      )}
      
      {pricingOpen && (
        <PricingModal
          isOpen={pricingOpen}
          onClose={() => setPricingOpen(false)}
          onUpgrade={checkSubscription}
        />
      )}
      
      {inviteOpen && (
        <InviteModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
          onSubmit={handleInvite}
        />
      )}
    </div>
  );
};

export default Dashboard;