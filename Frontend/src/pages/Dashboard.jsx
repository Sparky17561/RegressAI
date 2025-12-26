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
  const { isPremium, deepDivesRemaining, checkSubscription } = usePremium();
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

  const loadCaseDetails = async (caseId) => {
    try {
      const [caseData, members] = await Promise.all([
        apiService.fetchCase(caseId),
        apiService.fetchTeamMembers(caseId)
      ]);
      
      setVersions(caseData.versions || []);
      setTeamMembers(members);
      
      if (caseData.versions?.length > 0) {
        setSelectedVersion(caseData.versions[0]);
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

  const handleRunAnalysis = async (inputs) => {
    try {
      const payload = {
        ...inputs,
        user_id: currentUser.uid,
        case_id: activeCase?.case_id || null,
        case_name: activeCase?.name || 'Untitled Case'
      };
      
      const result = await apiService.runAnalysis(payload);
      
      // Update version list
      const updatedCase = await apiService.fetchCase(result.case_id);
      setVersions(updatedCase.versions || []);
      setSelectedVersion(result);
      
      // Refresh cases list
      const casesData = await apiService.fetchCases();
      setCases(casesData.cases || []);
      
      return result;
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  };

  const handleDeepDive = async (inputs) => {
    if (!isPremium) {
      setPricingOpen(true);
      return;
    }
    
    if (deepDivesRemaining <= 0) {
      alert('No deep dives remaining this month');
      return;
    }
    
    try {
      const payload = {
        ...inputs,
        user_id: currentUser.uid,
        case_id: activeCase?.case_id || null,
        case_name: activeCase?.name || 'Deep Dive Analysis',
        n_cases: Math.max(inputs.n_cases || 3, 10)
      };
      
      const result = await apiService.runDeepDive(payload);
      
      // Update version list
      const updatedCase = await apiService.fetchCase(result.case_id);
      setVersions(updatedCase.versions || []);
      setSelectedVersion(result);
      
      // Refresh cases and subscription
      await Promise.all([
        apiService.fetchCases().then(setCases),
        checkSubscription()
      ]);
      
      return result;
    } catch (error) {
      console.error('Deep dive failed:', error);
      throw error;
    }
  };

  const handleSelectVersion = async (version) => {
    try {
      const versionData = await apiService.fetchVersion(version.version_id);
      setSelectedVersion(versionData);
      
      // Load comments for this version
      const commentsData = await apiService.fetchComments(versionData.version_id);
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
          isPremium={isPremium}
        />

        <div className="main-panel">
          <SetupPanel
            activeCase={activeCase}
            selectedVersion={selectedVersion}
            onRunAnalysis={handleRunAnalysis}
            onDeepDive={handleDeepDive}
            onInvite={() => setInviteOpen(true)}
            teamMembers={teamMembers}
            isPremium={isPremium}
            deepDivesRemaining={deepDivesRemaining}
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