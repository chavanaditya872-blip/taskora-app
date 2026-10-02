/* Dashboard: stats, chart, task list, filters, and WebSocket sync. */
const Dashboard = (() => {
  const state = {
    tasks: [],
    categories: [],
    view: '',
    search: '',
    status: '',
    priority: '',
    category_id: '',
    sort: 'created_at:desc',
  };

  function renderStats(stats) {
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statInProgress').textContent = stats.in_progress;
    document.getElementById('statCompleted').textContent = stats.completed;
    document.getElementById('statOverdue').textContent = stats.overdue;
    renderChart(stats);
  }

  function renderChart(stats) {
    const el = document.getElementById('chartBars');
    const items = [
      { label: 'Pending', value: stats.pending },
      { label: 'In Progress', value: stats.in_progress },
      { label: 'Completed', value: stats.completed },
      { label: 'Overdue', value: stats.overdue },
    ];
    const max = Math.max(1, ...items.map(i => i.value));
    el.innerHTML = items.map(i => `
      <div class="chart-bar">
        <div class="bar-value">${i.value}</div>
        <div class="bar" style="height:${(i.value / max) * 120 + 6}px"></div>
        <div class="bar-label">${i.label}</div>
      </div>
    `).join('');
  }

  function attachTaskListHandlers() {
    const list = document.getElementById('taskList');
    list.querySelectorAll('.task-card').forEach(card => {
      const id = parseInt(card.dataset.id, 10);
      card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const task = state.tasks.find(t => t.id === id);
          if (!task) return;
          if (action === 'view') {
            TaskModal.open(task, state.categories);
          } else if (action === 'edit') {
            window.location.href = `task.html?id=${id}`;
          } else if (action === 'delete') {
            if (!confirmDialog('Delete this task?')) return;
            try {
              await API.deleteTask(id);
              showToast('Task deleted', 'success');
              refresh();
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });
    });
  }

  function renderTaskList() {
    const list = document.getElementById('taskList');
    const empty = document.getElementById('emptyState');
    if (!state.tasks.length) {
      list.innerHTML = `<div class="empty-state">No tasks match the current filters.</div>`;
      return;
    }
    list.innerHTML = state.tasks.map(taskCardHTML).join('');
    attachTaskListHandlers();
  }

  async function refresh() {
    const params = {
      view: state.view,
      search: state.search,
      status: state.status,
      priority: state.priority,
      category_id: state.category_id,
      sort: state.sort.split(':')[0],
      order: state.sort.split(':')[1],
    };
    try {
      const [tasks, stats] = await Promise.all([
        API.listTasks(params),
        API.taskStats(),
      ]);
      // Enrich with category names
      state.tasks = tasks.map(t => ({
        ...t,
        category_name: (state.categories.find(c => c.id === t.category_id) || {}).name || '',
      }));
      renderStats(stats);
      renderTaskList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function loadCategories() {
    try {
      state.categories = await API.listCategories();
      const sel = document.getElementById('filterCategory');
      sel.innerHTML = '<option value="">All categories</option>' +
        state.categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    } catch (err) { showToast(err.message, 'error'); }
  }

  function bindFilters() {
    const search = document.getElementById('searchInput');
    let searchTimer;
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = search.value.trim(); refresh(); }, 250);
    });
    document.getElementById('filterStatus').addEventListener('change', (e) => { state.status = e.target.value; refresh(); });
    document.getElementById('filterPriority').addEventListener('change', (e) => { state.priority = e.target.value; refresh(); });
    document.getElementById('filterCategory').addEventListener('change', (e) => { state.category_id = e.target.value; refresh(); });
    document.getElementById('sortBy').addEventListener('change', (e) => { state.sort = e.target.value; refresh(); });

    document.querySelectorAll('#viewTabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#viewTabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.view = btn.dataset.view;
        refresh();
      });
    });
  }

  function connectWebSocket() {
    const token = Auth.getToken();
    if (!token) return;
    const wsUrl = API_BASE.replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(token)}`;
    let ws;
    try { ws = new WebSocket(wsUrl); } catch { return; }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'connected') return;
        // For any task event, refresh
        if (msg.event?.startsWith('task.')) {
          refresh();
        }
      } catch {}
    };
    ws.onclose = () => {
      // Reconnect after a short delay
      setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }

  function init() {
    Auth.requireAuth();
    initShell();
    bindFilters();
    loadCategories().then(refresh);
    connectWebSocket();
  }

  return { init, refresh };
})();

Dashboard.init();