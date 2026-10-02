/* Profile page: user info editing and category management. */
(function () {
  Auth.requireAuth();
  initShell();

  const user = Auth.getUser();
  const form = document.getElementById('profileForm');
  const msg = document.getElementById('formMessage');

  async function loadMe() {
    try {
      const me = await API.me();
      Auth.setUser(me);
      document.getElementById('full_name').value = me.full_name;
      document.getElementById('email').value = me.email;
      document.getElementById('userNameSide').textContent = me.full_name;
      document.getElementById('userEmailSide').textContent = me.email;
      document.getElementById('userAvatar').textContent = me.full_name.charAt(0).toUpperCase();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    try {
      const updated = await API.updateMe({
        full_name: document.getElementById('full_name').value.trim(),
        email: document.getElementById('email').value.trim(),
      });
      Auth.setUser(updated);
      msg.textContent = 'Profile updated.';
      msg.className = 'form-message success';
      showToast('Profile updated', 'success');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-message error';
      showToast(err.message, 'error');
    } finally { btn.disabled = false; }
  });

  /* Categories */
  const catList = document.getElementById('categoryList');
  const catForm = document.getElementById('categoryForm');

  async function renderCategories() {
    try {
      const cats = await API.listCategories();
      catList.innerHTML = cats.map(c => `
        <li data-id="${c.id}">
          <span>${c.name.replace(/[<>&"']/g, '')}</span>
          <span class="actions">
            <button class="btn btn-ghost" data-edit>Rename</button>
            <button class="btn btn-danger" data-del>Delete</button>
          </span>
        </li>
      `).join('');
      catList.querySelectorAll('li').forEach(li => {
        const id = parseInt(li.dataset.id, 10);
        li.querySelector('[data-edit]').onclick = async () => {
          const name = prompt('New category name:');
          if (!name) return;
          try {
            await API.updateCategory(id, name.trim());
            showToast('Category updated', 'success');
            renderCategories();
          } catch (err) { showToast(err.message, 'error'); }
        };
        li.querySelector('[data-del]').onclick = async () => {
          if (!confirm('Delete this category?')) return;
          try {
            await API.deleteCategory(id);
            showToast('Category deleted', 'success');
            renderCategories();
          } catch (err) { showToast(err.message, 'error'); }
        };
      });
    } catch (err) { showToast(err.message, 'error'); }
  }

  catForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('newCategory');
    const name = input.value.trim();
    if (!name) return;
    try {
      await API.createCategory(name);
      input.value = '';
      showToast('Category added', 'success');
      renderCategories();
    } catch (err) { showToast(err.message, 'error'); }
  });

  loadMe();
  renderCategories();
})();