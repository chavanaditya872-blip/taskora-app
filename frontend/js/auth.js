/* Handles login, register, and shared auth UI for authenticated pages. */

function showFieldError(field, message) {
  const el = document.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = message || '';
}

function clearErrors(form) {
  form.querySelectorAll('.error').forEach(e => (e.textContent = ''));
  const msg = document.getElementById('formMessage');
  if (msg) { msg.textContent = ''; msg.className = 'form-message'; }
}

function setLoading(btn, loading, loadingText = 'Please wait…') {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.disabled = false;
  }
}

/* --------------------------- Register page --------------------------- */
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  if (Auth.isAuthenticated()) window.location.href = 'dashboard.html';

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(registerForm);

    const full_name = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm_password').value;

    let valid = true;
    if (full_name.length < 2) { showFieldError('full_name', 'Enter your full name'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('email', 'Enter a valid email'); valid = false; }
    if (password.length < 8) { showFieldError('password', 'Password must be at least 8 characters'); valid = false; }
    if (password !== confirm) { showFieldError('confirm_password', 'Passwords do not match'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('submitBtn');
    setLoading(btn, true, 'Creating account…');
    try {
      const data = await API.register({ full_name, email, password });
      Auth.setToken(data.access_token);
      Auth.setUser(data.user);
      showToast('Account created! Redirecting…', 'success');
      setTimeout(() => (window.location.href = 'dashboard.html'), 700);
    } catch (err) {
      const msg = document.getElementById('formMessage');
      msg.textContent = err.message;
      msg.className = 'form-message error';
      showToast(err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

/* --------------------------- Login page --------------------------- */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  if (Auth.isAuthenticated()) window.location.href = 'dashboard.html';

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(loginForm);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    let valid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('email', 'Enter a valid email'); valid = false; }
    if (!password) { showFieldError('password', 'Password is required'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('submitBtn');
    setLoading(btn, true, 'Logging in…');
    try {
      const data = await API.login({ email, password });
      Auth.setToken(data.access_token);
      Auth.setUser(data.user);
      showToast('Welcome back!', 'success');
      setTimeout(() => (window.location.href = 'dashboard.html'), 500);
    } catch (err) {
      const msg = document.getElementById('formMessage');
      msg.textContent = err.message;
      msg.className = 'form-message error';
      showToast(err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

/* --------------------------- Shared shell UI --------------------------- */
function initShell() {
  const user = Auth.getUser();
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

  if (user) {
    setText('userNameSide', user.full_name || 'User');
    setText('userEmailSide', user.email || '-');
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.textContent = (user.full_name || 'U').charAt(0).toUpperCase();
    const welcome = document.getElementById('welcomeHeading');
    if (welcome) {
      const first = (user.full_name || 'there').split(' ')[0];
      welcome.textContent = `Welcome back, ${first} 👋`;
    }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await API.logout(); } catch {}
      Auth.clear();
      window.location.href = 'login.html';
    });
  }

  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 900 && !sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    });
  }
}