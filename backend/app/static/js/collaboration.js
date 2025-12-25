// collaboration.js - Team, Comments, Notifications & Invite
import { fetchTeamMembers, fetchCase } from "./api.js";
import { appState } from "./state.js";
import { $ } from "./utils.js";

/* =========================
   TEAM MEMBERS
========================= */

export async function loadTeamMembers() {
  if (!appState.activeCaseId) return;

  try {
    const data = await fetchTeamMembers(appState.activeCaseId);
    const members = data.members || [];

    // Separate owner and collaborators
    const owner = members.find(m => m.is_owner || m.role === "OWNER");
    const collaborators = members.filter(m => !m.is_owner && m.role !== "OWNER");

    // Update team avatars
    const avatarsEl = $("teamAvatars");
    if (avatarsEl) {
      let html = "";
      
      // Owner avatar
      if (owner) {
        const ownerEmail = owner.email || owner.display_name || "Owner";
        const initial = ownerEmail.charAt(0).toUpperCase();
        html += `<div class="team-avatar owner" title="${ownerEmail} (Owner)">${initial}</div>`;
      }
      
      // Collaborator avatars
      collaborators.forEach(m => {
        const emailOrName = m.email || m.display_name || "Member";
        const initial = emailOrName.charAt(0).toUpperCase();
        html += `<div class="team-avatar" title="${emailOrName}">${initial}</div>`;
      });
      
      avatarsEl.innerHTML = html || '<div class="team-avatar" title="You">👤</div>';
    }

    // Update team members list
    const listEl = $("teamMembersList");
    if (listEl) {
      let html = "";

      // Show owner
      if (owner) {
        const ownerName = owner.display_name || owner.email || "Owner";
        const ownerEmail = owner.email || "";
        const isYou = window.currentUser && window.currentUser.uid === owner.user_id;
        
        html += `
          <div class="member owner">
            <b>${ownerName}${isYou ? ' (You)' : ''}</b><br/>
            <small>${ownerEmail} • OWNER</small>
          </div>
        `;
      }

      // Show collaborators
      collaborators.forEach(m => {
        const displayName = m.display_name || m.email || "Unknown User";
        const email = m.email || "";
        const role = m.role || "VIEWER";
        const isYou = window.currentUser && window.currentUser.uid === m.user_id;
        
        html += `
          <div class="member">
            <b>${displayName}${isYou ? ' (You)' : ''}</b><br/>
            <small>${email} • ${role}</small>
          </div>
        `;
      });

      listEl.innerHTML = html || '<div class="muted">No team members</div>';
    }
  } catch (e) {
    console.error("Failed to load team members:", e);
    const avatarsEl = $("teamAvatars");
    if (avatarsEl) avatarsEl.innerHTML = '<div class="team-avatar" title="Error">⚠️</div>';
    
    const listEl = $("teamMembersList");
    if (listEl) listEl.innerHTML = '<div class="muted error">Error loading team members</div>';
  }
}
/* =========================
   COMMENTS
========================= */

export async function loadComments() {
  if (!appState.activeVersionId) {
    const el = $("commentsList");
    if (el) el.innerHTML = `<div class="muted">Select a version to see comments</div>`;
    return;
  }

  try {
    const res = await fetch("/api/comments/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: appState.activeVersionId })
    });

    const data = await res.json();
    const el = $("commentsList");
    if (!el) return;

    if (!data.comments?.length) {
      el.innerHTML = `<div class="muted">No comments yet</div>`;
      return;
    }

    el.innerHTML = data.comments.map(c => {
      const date = new Date(c.created_at).toLocaleString();
      const userName = c.user_name || c.user_email || "Anonymous";
      return `
        <div class="comment">
          <div class="comment-header">
            <b>${userName}</b>
            <span class="comment-date">${date}</span>
          </div>
          <div class="comment-body">${c.text}</div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error("Failed to load comments:", e);
  }
}

async function addComment() {
  const textEl = $("newCommentText");
  if (!textEl) return;
  
  const text = textEl.value.trim();
  if (!text) return;

  if (!appState.activeVersionId) {
    alert("Please select a version first");
    return;
  }

  if (!window.currentUser) {
    alert("You must be logged in to comment");
    return;
  }

  try {
    await fetch("/api/comments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: window.currentUser.uid,
        case_id: appState.activeCaseId,
        version_id: appState.activeVersionId,
        text
      })
    });

    textEl.value = "";
    await loadComments();
  } catch (e) {
    console.error("Failed to add comment:", e);
    alert("Failed to add comment");
  }
}

/* =========================
   NOTIFICATIONS
========================= */

function toggleNotifications() {
  const panel = $("notificationsPanel");
  if (!panel) return;
  
  const isVisible = panel.style.display === "block";
  panel.style.display = isVisible ? "none" : "block";
}

export async function loadNotifications() {
  if (!window.currentUser) {
    console.log('[Notifications] Waiting for auth...');
    setTimeout(loadNotifications, 500);
    return;
  }
  
  console.log('[Notifications] Loading...');
  
  try {
    const [notifRes, inviteRes] = await Promise.all([
      fetch("/api/notifications/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: window.currentUser.uid })
      }),
      fetch("/api/invitations/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: window.currentUser.uid })
      })
    ]);

    const notifData = await notifRes.json();
    const inviteData = await inviteRes.json();
    
    const notifications = notifData.notifications || [];
    const invitations = inviteData.invitations || [];

    console.log('[Notifications] Counts:', { 
      notifications: notifications.length, 
      invitations: invitations.length 
    }); // ✅ ADD THIS

    // Update badge count
    const countEl = $("notifCount");
    console.log('[Notifications] Badge element:', countEl); // ✅ ADD THIS
    if (countEl) {
      const totalCount = (notifData.unread_count || 0) + invitations.length;
      countEl.innerText = totalCount;
      console.log('[Notifications] Badge count set to:', totalCount); // ✅ ADD THIS
    }

    const listEl = $("notificationsList");
    console.log('[Notifications] List element:', listEl); // ✅ ADD THIS
    if (!listEl) return;

    let html = "";

    // Add invitations first
    if (invitations.length > 0) {
      console.log('[Notifications] Rendering invitations:', invitations); // ✅ ADD THIS
      html += invitations.map(inv => `
        <div class="notification invitation unread">
          <div class="notification-header">
            <b>📬 Invitation</b>
            <span class="notification-date">${new Date(inv.created_at).toLocaleString()}</span>
          </div>
          <div class="notification-body">
            <p><strong>${inv.invited_by_name || inv.invited_by_email}</strong> invited you to collaborate on <strong>${inv.case_name}</strong></p>
            <p><small>Role: ${inv.role}</small></p>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              <button class="btn small primary" onclick="window.respondToInvitation('${inv.invitation_id}', 'accept')">
                Accept
              </button>
              <button class="btn small alt" onclick="window.respondToInvitation('${inv.invitation_id}', 'reject')">
                Decline
              </button>
            </div>
          </div>
        </div>
      `).join("");
    }

    // Add regular notifications
    if (notifications.length > 0) {
      html += notifications.map(n => `
        <div class="notification ${n.read ? '' : 'unread'}">
          <div class="notification-header">
            <b>${n.type}</b>
            <span class="notification-date">${new Date(n.created_at).toLocaleString()}</span>
          </div>
          <div class="notification-body">${n.message}</div>
        </div>
      `).join("");
    }

    // Show message if nothing
    if (html === "") {
      html = '<div class="muted">No notifications</div>';
    }

    console.log('[Notifications] Final HTML length:', html.length); // ✅ ADD THIS
    listEl.innerHTML = html;
    console.log('[Notifications] Rendered successfully'); // ✅ ADD THIS
  } catch (e) {
    console.error("Failed to load notifications:", e);
  }
}

/* =========================
   INVITE MODAL
========================= */

function openInviteModal() {
  if (!appState.activeCaseId) {
    alert("Please select a case first");
    return;
  }
  
  const modal = $("inviteModal");
  if (modal) modal.style.display = "flex";
}

function closeInviteModal() {
  const modal = $("inviteModal");
  if (modal) modal.style.display = "none";
  
  // Clear inputs
  const emailEl = $("inviteEmail");
  const roleEl = $("inviteRole");
  if (emailEl) emailEl.value = "";
  if (roleEl) roleEl.value = "VIEWER";
}

async function sendInvite() {
  const emailEl = $("inviteEmail");
  const roleEl = $("inviteRole");
  
  if (!emailEl || !roleEl) return;
  
  const email = emailEl.value.trim();
  const role = roleEl.value;
  
  if (!email) {
    alert("Please enter an email address");
    return;
  }

  if (!window.currentUser) {
    alert("You must be logged in to send invitations");
    return;
  }

  try {
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: window.currentUser.uid,
        case_id: appState.activeCaseId,
        invited_email: email,  // ✅ Fixed: backend expects "invited_email", not "email"
        role
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Failed to send invite" }));
      throw new Error(errorData.detail || "Failed to send invite");
    }

    alert("Invitation sent!");
    closeInviteModal();
    await loadTeamMembers();
  } catch (e) {
    console.error("Failed to send invite:", e);
    alert("Failed to send invitation: " + e.message);
  }
}

/* =========================
   DOM BINDINGS
========================= */

document.addEventListener("DOMContentLoaded", () => {
  // Notifications
  $("notifBell")?.addEventListener("click", toggleNotifications);
  $("closeNotifBtn")?.addEventListener("click", toggleNotifications);
  $("refreshNotifBtn")?.addEventListener("click", loadNotifications);

  // Invite modal
  $("inviteBtn")?.addEventListener("click", openInviteModal);
  $("closeInviteBtn")?.addEventListener("click", closeInviteModal);
  $("cancelInviteBtn")?.addEventListener("click", closeInviteModal);
  $("sendInviteBtn")?.addEventListener("click", sendInvite);

  // Comments
  $("postCommentBtn")?.addEventListener("click", addComment);
  
  // Close modals on outside click
  window.addEventListener("click", (e) => {
    const inviteModal = $("inviteModal");
    if (e.target === inviteModal) {
      closeInviteModal();
    }
  });
});

/* =========================
   RESPOND TO INVITATION
========================= */

async function respondToInvitation(invitationId, action) {
  if (!window.currentUser) return;
  
  try {
    const res = await fetch("/api/invitations/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: window.currentUser.uid,
        invitation_id: invitationId,
        action: action
      })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Failed to respond" }));
      throw new Error(error.detail);
    }

    // Reload notifications to remove the invitation
    await loadNotifications();
    
    if (action === "accept") {
      alert("Invitation accepted! The case will now appear in your cases list.");
      // Reload cases if the function exists
      if (window.loadCases) {
        await window.loadCases();
      }
    }
  } catch (e) {
    console.error("Failed to respond to invitation:", e);
    alert("Failed to respond: " + e.message);
  }
}

/* =========================
   EXPORTS
========================= */

export { addComment, toggleNotifications, openInviteModal, closeInviteModal, sendInvite, respondToInvitation };

// Global exports for HTML onclick attributes (legacy support)
window.loadTeamMembers = loadTeamMembers;
window.loadComments = loadComments;
window.addComment = addComment;
window.toggleNotifications = toggleNotifications;
window.respondToInvitation = respondToInvitation;