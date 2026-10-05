/* Task HTML Card Generator */
function taskCardHTML(task) {
  const isDone = task.status === 'completed';
  const overdue = isOverdue(task.due_date, task.status);

  return `
    <div class="task-card ${isDone ? 'completed' : ''} ${overdue ? 'overdue' : ''}" data-id="${task.id}">
      <div class="task-card-header">
        <span class="badge priority-${task.priority}">${priorityLabel(task.priority)}</span>
        <span class="badge status-${task.status}">${statusLabel(task.status)}</span>
      </div>
      <h3 class="task-title">${escapeHTML(task.title)}</h3>
      <p class="task-desc">${escapeHTML(task.description || '')}</p>
      <div class="task-card-footer">
        <span class="task-date">Due: ${formatDateShort(task.due_date)}</span>
        <div class="task-actions">
          <button data-action="view" class="btn btn-sm btn-ghost">View</button>
          <button data-action="edit" class="btn btn-sm btn-ghost">Edit</button>
          <button data-action="delete" class="btn btn-sm btn-ghost text-danger">Delete</button>
        </div>
      </div>
    </div>
  `;
}
/* ------------- Task creation/edit page ------------- */
const TaskPage = {
  categories: [],

  async loadCategories(selectedId = null) {
    try {
      this.categories = await API.listCategories();
      const sel = document.getElementById('category_id');
      if (!sel) return;
      sel.innerHTML = '<option value="">None</option>' +
        this.categories.map(c =>
          `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
        ).join('');
    } catch (err) {
      console.error('loadCategories failed:', err);
      showToast(err.message, 'error');
    }
  },

  toLocalInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  async loadForEdit(taskId) {
    try {
      const task = await API.getTask(taskId);
      await this.loadCategories(task.category_id);
      document.getElementById('title').value = task.title;
      document.getElementById('description').value = task.description || '';
      document.getElementById('priority').value = task.priority;
      document.getElementById('status').value = task.status;
      document.getElementById('due_date').value = this.toLocalInput(task.due_date);
      document.getElementById('reminder_at').value = this.toLocalInput(task.reminder_at);
      document.getElementById('taskForm').dataset.id = task.id;
    } catch (err) {
      console.error('loadForEdit failed:', err);
      showToast(err.message, 'error');
    }
  },

  // Safely parse a datetime-local input value into an ISO string, or null.
  parseLocalDate(v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date value: "${v}"`);
    }
    return d.toISOString();
  },

  collect() {
    const due = document.getElementById('due_date').value;
    const reminder = document.getElementById('reminder_at').value;
    const catVal = document.getElementById('category_id').value;
    return {
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim() || null,
      priority: document.getElementById('priority').value,
      status: document.getElementById('status').value,
      category_id: catVal ? parseInt(catVal, 10) : null,
      due_date: this.parseLocalDate(due),
      reminder_at: this.parseLocalDate(reminder),
    };
  },
};

const taskForm = document.getElementById('taskForm');
if (taskForm) {
  Auth.requireAuth();
  try { initShell(); } catch (e) { console.error('initShell failed:', e); }

  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('formMessage');

    let payload;
    try {
      payload = TaskPage.collect();          // ← move inside try
    } catch (err) {
      console.error('collect failed:', err);
      showToast(err.message, 'error');
      return;
    }

    if (!payload.title) {
      showToast('Title is required', 'error');
      return;
    }

    console.log('[Taskora] POST payload:', payload);   // temp debug

    btn.disabled = true;
    try {
      const id = taskForm.dataset.id;
      let saved;
      if (id) {
        saved = await API.updateTask(id, payload);
        showToast('Task updated', 'success');
      } else {
        saved = await API.createTask(payload);
        showToast('Task created', 'success');
      }
      console.log('[Taskora] server responded:', saved);   // temp debug
      setTimeout(() => (window.location.href = 'dashboard.html'), 700);
    } catch (err) {
      console.error('[Taskora] save failed:', err);
      msg.textContent = err.message;
      msg.className = 'form-message error';
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}