import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import './Notifications.css';

const Notifications = ({ onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const [notifsData, invitesData] = await Promise.all([
        apiService.fetchNotifications(),
        apiService.fetchPendingInvitations()
      ]);
      
      setNotifications(notifsData.notifications || []);
      setInvitations(invitesData.invitations || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    try {
      await apiService.respondToInvitation(invitationId, action);
      
      if (action === 'accept') {
        alert('Invitation accepted! The case will appear in your cases list.');
        // Refresh the page to update cases
        window.location.reload();
      }
      
      // Remove invitation from list
      setInvitations(prev => prev.filter(inv => inv.invitation_id !== invitationId));
    } catch (error) {
      alert(`Failed to ${action} invitation: ${error.message}`);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.notification_id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const filteredNotifications = activeTab === 'invitations' 
    ? invitations
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;
  const totalCount = unreadCount + invitations.length;

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notifications-overlay" onClick={onClose}>
      <div className="notifications-panel" onClick={e => e.stopPropagation()}>
        <div className="notifications-header">
          <h3>
            Notifications
            {totalCount > 0 && (
              <span className="notifications-count">{totalCount}</span>
            )}
          </h3>
          <div className="header-actions">
            {unreadCount > 0 && (
              <button 
                className="btn-link"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
            <button 
              className="btn-icon close-btn"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="notifications-tabs">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
            {notifications.length > 0 && (
              <span className="tab-count">{notifications.length}</span>
            )}
          </button>
          <button
            className={`tab-btn ${activeTab === 'invitations' ? 'active' : ''}`}
            onClick={() => setActiveTab('invitations')}
          >
            Invitations
            {invitations.length > 0 && (
              <span className="tab-count invitations">{invitations.length}</span>
            )}
          </button>
        </div>

        <div className="notifications-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                {activeTab === 'invitations' ? '📭' : '🔔'}
              </div>
              <p>
                {activeTab === 'invitations' 
                  ? 'No pending invitations' 
                  : 'No notifications'
                }
              </p>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map((item) => {
                if (activeTab === 'invitations') {
                  return (
                    <div key={item.invitation_id} className="notification-item invitation">
                      <div className="notification-icon">📬</div>
                      <div className="notification-content">
                        <div className="notification-header">
                          <strong>Invitation</strong>
                          <span className="notification-time">
                            {formatTime(item.created_at)}
                          </span>
                        </div>
                        <div className="notification-body">
                          <p>
                            <strong>{item.invited_by_name || item.invited_by_email}</strong> 
                            {' '}invited you to collaborate on{' '}
                            <strong>{item.case_name}</strong>
                          </p>
                          <p className="notification-meta">
                            Role: {item.role}
                          </p>
                          <div className="invitation-actions">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleInvitationResponse(item.invitation_id, 'accept')}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleInvitationResponse(item.invitation_id, 'reject')}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={item.notification_id} 
                    className={`notification-item ${item.read ? '' : 'unread'}`}
                    onClick={() => markAsRead(item.notification_id)}
                  >
                    <div className="notification-icon">
                      {item.type === 'analysis_complete' ? '📊' : 
                       item.type === 'comment' ? '💬' : 
                       item.type === 'team' ? '👥' : '🔔'}
                    </div>
                    <div className="notification-content">
                      <div className="notification-header">
                        <strong>{item.title}</strong>
                        <span className="notification-time">
                          {formatTime(item.created_at)}
                        </span>
                      </div>
                      <div className="notification-body">
                        <p>{item.message}</p>
                        {!item.read && (
                          <span className="unread-badge">New</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="notifications-footer">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadNotifications}
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notifications;