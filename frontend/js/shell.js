// js/shell.js
function initShell() {
  // If you have auth user info stored, populate the sidebar
  const user = Auth && typeof Auth.getUser === 'function' ? Auth.getUser() : null;
  if (user) {
    const nameEl = document.getElementById('userNameSide');
    const emailEl = document.getElementById('userEmailSide');
    const avatarEl = document.getElementById('userAvatar');
    
    if (nameEl && user.name) nameEl.textContent = user.name;
    if (emailEl && user.email) emailEl.textContent = user.email;
    if (avatarEl && user.name) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  }

  // Handle mobile menu toggle if present
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Handle logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && typeof Auth !== 'undefined' && Auth.logout) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout();
    });
  }
}