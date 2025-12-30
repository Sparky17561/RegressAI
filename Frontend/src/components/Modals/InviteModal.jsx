import { useState } from 'react';
import { X, UserPlus, Eye, Edit2, Mail, Shield, Check } from 'lucide-react';
import './InviteModal.css';

const InviteModal = ({ isOpen, onClose, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      alert('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(email, role);
    } catch (error) {
      // Error handling done in parent
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
             <div className="modal-icon-bg"><UserPlus size={20} className="text-primary" /></div>
             <h3>Invite Collaborator</h3>
          </div>
          <button className="btn-icon close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="inviteEmail"><Mail size={16} className="label-icon" /> Email Address</label>
              <input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collaborator@example.com"
                disabled={loading}
                autoFocus
                className="input-premium"
              />
              <div className="input-hint">
                Enter the email address of the person you want to invite
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="inviteRole"><Shield size={16} className="label-icon" /> Access Level</label>
              <div className="role-selector">
                <div className="role-options">
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="VIEWER"
                      checked={role === 'VIEWER'}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={loading}
                    />
                    <div className="role-content">
                      <div className="role-header">
                        <span className="role-icon"><Eye size={18} /></span>
                        <span className="role-name">Viewer</span>
                         {role === 'VIEWER' && <Check size={16} className="role-check" />}
                      </div>
                      <p className="role-description">
                        Can view cases and results, but cannot run analyses or make changes
                      </p>
                    </div>
                  </label>

                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="EDITOR"
                      checked={role === 'EDITOR'}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={loading}
                    />
                    <div className="role-content">
                      <div className="role-header">
                        <span className="role-icon"><Edit2 size={18} /></span>
                        <span className="role-name">Editor</span>
                         {role === 'EDITOR' && <Check size={16} className="role-check" />}
                      </div>
                      <p className="role-description">
                        Can run analyses, add comments, and collaborate on cases
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-text"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-with-icon"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <>
                  <div className="spinner small"></div>
                  Sending...
                </>
              ) : (
                <>
                <Mail size={16} />
                Send Invite
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteModal;