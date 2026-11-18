/**
 * app.js
 * Frontend JavaScript for Distributed Task Scheduling System
 * 
 * Written in Vanilla JavaScript for beginner college course project.
 * Uses standard fetch() API for communication with Express backend.
 */

// Global state variables to hold fetched data
let allTasks = [];
let allMembers = [];
let aiRecommendations = {}; // Stores AI recommendations keyed by task_id

// When DOM is fully loaded, initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  loadMembers();
  loadStats();
  loadTasks();

  // Set today's date as default minimum for deadline input
  const today = new Date().toISOString().split('T')[0];
  const deadlineInput = document.getElementById('task-deadline');
  if (deadlineInput) {
    deadlineInput.min = today;
  }
});

// ==========================================
// 1. PAGE NAVIGATION (Tabs)
// ==========================================
function switchPage(pageName) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach((section) => {
    section.classList.remove('active');
  });

  // Remove active class from all nav buttons
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  // Show selected section and activate button
  const targetSection = document.getElementById(`${pageName}-page`);
  const targetBtn = document.getElementById(`tab-${pageName}`);

  if (targetSection && targetBtn) {
    targetSection.classList.add('active');
    targetBtn.classList.add('active');
  }

  // Refresh relevant data when switching pages
  if (pageName === 'dashboard') {
    loadStats();
    loadTasks();
    loadMembers();
  } else if (pageName === 'tasks') {
    loadTasks();
    loadMembers();
  } else if (pageName === 'members') {
    loadMembers();
  }
}

// ==========================================
// 2. DASHBOARD DATA LOADING
// ==========================================
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const result = await response.json();

    if (result.success && result.data) {
      document.getElementById('stat-total').textContent = result.data.total;
      document.getElementById('stat-pending').textContent = result.data.pending;
      document.getElementById('stat-progress').textContent = result.data.inProgress;
      document.getElementById('stat-completed').textContent = result.data.completed;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ==========================================
// 3. TEAM MEMBERS DATA LOADING
// ==========================================
async function loadMembers() {
  try {
    const response = await fetch('/api/members');
    const result = await response.json();

    if (result.success && result.data) {
      allMembers = result.data;

      // Populate "Assign Member" dropdowns
      populateMemberDropdowns(allMembers);

      // Render Members Table
      renderMembersTable(allMembers);

      // Render Workload distribution preview in Dashboard
      renderWorkloadSummary(allMembers);
    }
  } catch (error) {
    console.error('Error loading members:', error);
  }
}

function populateMemberDropdowns(members) {
  const taskAssignedSelect = document.getElementById('task-assigned');
  const editTaskAssignedSelect = document.getElementById('edit-task-assigned');

  // Preserve first placeholder option
  taskAssignedSelect.innerHTML = '<option value="">-- Select Member --</option>';
  editTaskAssignedSelect.innerHTML = '<option value="">-- Unassigned --</option>';

  members.forEach((member) => {
    const opt1 = document.createElement('option');
    opt1.value = member.member_id;
    opt1.textContent = `${member.name} (${member.email})`;
    taskAssignedSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = member.member_id;
    opt2.textContent = `${member.name} (${member.email})`;
    editTaskAssignedSelect.appendChild(opt2);
  });
}

function renderMembersTable(members) {
  const tbody = document.getElementById('members-tbody');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No team members registered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  members.forEach((m) => {
    const tr = document.createElement('tr');
    const count = Number(m.task_count) || 0;
    
    // Status text based on workload
    let workloadStatus = '<span class="badge badge-low">Available</span>';
    if (count > 3) {
      workloadStatus = '<span class="badge badge-high">Heavy Workload</span>';
    } else if (count > 0) {
      workloadStatus = '<span class="badge badge-medium">Active (${count} tasks)</span>';
    }

    tr.innerHTML = `
      <td><strong>#${m.member_id}</strong></td>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml(m.email)}</td>
      <td><strong>${count}</strong> task(s)</td>
      <td>${workloadStatus}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderWorkloadSummary(members) {
  const container = document.getElementById('workload-list');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = '<p class="text-center">No team members available.</p>';
    return;
  }

  container.innerHTML = '';
  members.forEach((m) => {
    const count = Number(m.task_count) || 0;
    const item = document.createElement('div');
    item.className = 'workload-item';
    item.innerHTML = `
      <div>
        <div class="workload-name">${escapeHtml(m.name)}</div>
        <div class="workload-email">${escapeHtml(m.email)}</div>
      </div>
      <div class="workload-count">${count} Assigned</div>
    `;
    container.appendChild(item);
  });
}

// ==========================================
// 4. TASKS DATA LOADING & RENDERING
// ==========================================
async function loadTasks() {
  try {
    const response = await fetch('/api/tasks');
    const result = await response.json();

    if (result.success && result.data) {
      allTasks = result.data;
      renderTasksTable(allTasks);
      renderRecentTasks(allTasks);
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById('all-tasks-tbody');
  if (!tbody) return;

  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No tasks scheduled yet. Create one above!</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  tasks.forEach((t) => {
    const tr = document.createElement('tr');

    // Priority badge
    let priorityClass = 'badge-medium';
    if (t.priority === 'High') priorityClass = 'badge-high';
    if (t.priority === 'Low') priorityClass = 'badge-low';

    // Format deadline
    const deadlineFormatted = t.deadline ? formatDate(t.deadline) : 'None';

    // Build AI Recommendation column content
    const rec = aiRecommendations[t.task_id];
    let aiCellHtml = `
      <button type="button" class="btn-ai btn-sm" id="ai-btn-${t.task_id}" onclick="getTaskAiRecommendation(${t.task_id})">
        Ask AI
      </button>
    `;

    if (rec && rec.loading) {
      aiCellHtml = `<span style="color:#6d28d9; font-size:12px;">Thinking...</span>`;
    } else if (rec && rec.recommended_member_name) {
      const isAlreadyAssigned = Number(t.assigned_to) === Number(rec.recommended_member_id);
      const actionBadge = isAlreadyAssigned
        ? `<span class="ai-matched-badge">Assigned</span>`
        : `<button type="button" class="btn-apply-ai" onclick="applyAiRecommendation(${t.task_id})">Apply</button>`;

      aiCellHtml = `
        <div class="ai-rec-box">
          <div class="ai-rec-header">
            <span class="ai-rec-name">Suggest: ${escapeHtml(rec.recommended_member_name)}</span>
            ${actionBadge}
          </div>
          <div class="ai-rec-reason">${escapeHtml(rec.reason)}</div>
        </div>
      `;
    }

    tr.innerHTML = `
      <td><strong>#${t.task_id}</strong></td>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td>${t.member_name ? escapeHtml(t.member_name) : '<em style="color:#94a3b8;">Unassigned</em>'}</td>
      <td><span class="badge ${priorityClass}">${escapeHtml(t.priority)}</span></td>
      <td>${deadlineFormatted}</td>
      <td>
        <select class="status-select" onchange="quickUpdateStatus(${t.task_id}, this.value)">
          <option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
      <td>${aiCellHtml}</td>
      <td>
        <button type="button" class="btn-edit" onclick="openEditModal(${t.task_id})">Edit</button>
        <button type="button" class="btn-delete" onclick="handleDeleteTask(${t.task_id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRecentTasks(tasks) {
  const tbody = document.getElementById('recent-tasks-tbody');
  if (!tbody) return;

  const recent = tasks.slice(0, 5); // Show first 5 tasks
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tasks scheduled yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  recent.forEach((t) => {
    const tr = document.createElement('tr');

    let priorityClass = 'badge-medium';
    if (t.priority === 'High') priorityClass = 'badge-high';
    if (t.priority === 'Low') priorityClass = 'badge-low';

    let statusClass = 'status-pending';
    if (t.status === 'In Progress') statusClass = 'status-progress';
    if (t.status === 'Completed') statusClass = 'status-completed';

    const deadlineFormatted = t.deadline ? formatDate(t.deadline) : '-';

    tr.innerHTML = `
      <td>#${t.task_id}</td>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td>${t.member_name ? escapeHtml(t.member_name) : '<em>Unassigned</em>'}</td>
      <td><span class="badge ${priorityClass}">${escapeHtml(t.priority)}</span></td>
      <td>${deadlineFormatted}</td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(t.status)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 5. CREATE TASK
// ==========================================
async function handleCreateTask(event) {
  event.preventDefault();

  const title = document.getElementById('task-title').value.trim();
  const assigned_to = document.getElementById('task-assigned').value;
  const priority = document.getElementById('task-priority').value;
  const deadline = document.getElementById('task-deadline').value;
  const status = document.getElementById('task-status').value;

  if (!title) {
    showNotification('Please enter a task title.', 'error');
    return;
  }

  const payload = {
    title,
    assigned_to: assigned_to ? Number(assigned_to) : null,
    priority,
    deadline: deadline || null,
    status
  };

  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Task scheduled and assigned successfully!', 'success');
      document.getElementById('create-task-form').reset();
      const reasonHint = document.getElementById('new-task-ai-reason');
      if (reasonHint) reasonHint.textContent = '';
      
      // Refresh state
      await loadTasks();
      await loadStats();
      await loadMembers();
    } else {
      showNotification(result.message || 'Failed to create task', 'error');
    }
  } catch (error) {
    console.error('Error creating task:', error);
    showNotification('Server communication error.', 'error');
  }
}

// ==========================================
// 6. QUICK STATUS UPDATE
// ==========================================
async function quickUpdateStatus(taskId, newStatus) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Task #${taskId} marked as ${newStatus}`, 'success');
      // Update local task state and stats
      const task = allTasks.find((t) => t.task_id === taskId);
      if (task) task.status = newStatus;
      loadStats();
      renderRecentTasks(allTasks);
    } else {
      showNotification(result.message || 'Failed to update status', 'error');
      loadTasks(); // revert dropdown on error
    }
  } catch (error) {
    console.error('Error updating task status:', error);
    showNotification('Failed to update task status.', 'error');
  }
}

// ==========================================
// 7. EDIT TASK (MODAL)
// ==========================================
function openEditModal(taskId) {
  const task = allTasks.find((t) => t.task_id === taskId);
  if (!task) return;

  document.getElementById('edit-task-id').value = task.task_id;
  document.getElementById('edit-task-title').value = task.title;
  document.getElementById('edit-task-assigned').value = task.assigned_to || '';
  document.getElementById('edit-task-priority').value = task.priority || 'Medium';
  document.getElementById('edit-task-deadline').value = task.deadline ? task.deadline.split('T')[0] : '';
  document.getElementById('edit-task-status').value = task.status || 'Pending';

  document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('active');
}

async function handleUpdateTask(event) {
  event.preventDefault();

  const taskId = document.getElementById('edit-task-id').value;
  const title = document.getElementById('edit-task-title').value.trim();
  const assigned_to = document.getElementById('edit-task-assigned').value;
  const priority = document.getElementById('edit-task-priority').value;
  const deadline = document.getElementById('edit-task-deadline').value;
  const status = document.getElementById('edit-task-status').value;

  if (!title) {
    showNotification('Task title cannot be empty.', 'error');
    return;
  }

  const payload = {
    title,
    assigned_to: assigned_to ? Number(assigned_to) : null,
    priority,
    deadline: deadline || null,
    status
  };

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Task updated successfully!', 'success');
      closeEditModal();
      await loadTasks();
      await loadStats();
      await loadMembers();
    } else {
      showNotification(result.message || 'Failed to update task', 'error');
    }
  } catch (error) {
    console.error('Error updating task:', error);
    showNotification('Error updating task details.', 'error');
  }
}

// ==========================================
// 8. DELETE TASK
// ==========================================
async function handleDeleteTask(taskId) {
  const confirmed = window.confirm(`Are you sure you want to delete task #${taskId}?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Task #${taskId} deleted successfully`, 'success');
      await loadTasks();
      await loadStats();
      await loadMembers();
    } else {
      showNotification(result.message || 'Failed to delete task', 'error');
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    showNotification('Error deleting task.', 'error');
  }
}

// ==========================================
// 9. CREATE TEAM MEMBER
// ==========================================
async function handleCreateMember(event) {
  event.preventDefault();

  const name = document.getElementById('member-name').value.trim();
  const email = document.getElementById('member-email').value.trim();

  if (!name || !email) {
    showNotification('Both Name and Email are required.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(`Team member "${name}" added!`, 'success');
      document.getElementById('create-member-form').reset();
      await loadMembers();
    } else {
      showNotification(result.message || 'Failed to add member', 'error');
    }
  } catch (error) {
    console.error('Error adding member:', error);
    showNotification('Error adding member.', 'error');
  }
}

// ==========================================
// 10. SEARCH & FILTER TASKS
// ==========================================
function filterTasks() {
  const searchText = document.getElementById('task-search-input').value.toLowerCase().trim();
  const filterStatus = document.getElementById('task-filter-status').value;
  const filterPriority = document.getElementById('task-filter-priority').value;

  const filtered = allTasks.filter((t) => {
    // Search text match
    const titleMatch = t.title.toLowerCase().includes(searchText);
    const memberMatch = t.member_name && t.member_name.toLowerCase().includes(searchText);
    const matchesSearch = searchText === '' || titleMatch || memberMatch;

    // Status match
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;

    // Priority match
    const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  renderTasksTable(filtered);
}

// ==========================================
// 11. HELPER UTILITIES
// ==========================================
function showNotification(message, type = 'success') {
  const banner = document.getElementById('notification-banner');
  if (!banner) return;

  banner.textContent = message;
  banner.className = `notification-banner ${type}`;

  // Automatically dismiss after 3.5 seconds
  setTimeout(() => {
    banner.className = 'notification-banner';
    banner.textContent = '';
  }, 3500);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split('T')[0];
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// 12. AI RECOMMENDATION FUNCTIONS
// ==========================================

// Suggest an assignee while filling out the "Schedule New Task" form
async function suggestAssigneeForNewTask() {
  const title = document.getElementById('task-title').value.trim();
  const priority = document.getElementById('task-priority').value;
  const deadline = document.getElementById('task-deadline').value;
  const btn = document.getElementById('btn-ai-suggest');
  const reasonHint = document.getElementById('new-task-ai-reason');

  if (!title) {
    showNotification('Enter a task title first so AI can recommend a team member.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Thinking...';
  if (reasonHint) reasonHint.textContent = 'Analyzing team workload...';

  try {
    const response = await fetch('/api/ai/recommend-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, deadline }),
    });
    const result = await response.json();

    if (result.success && result.data) {
      document.getElementById('task-assigned').value = result.data.recommended_member_id;
      if (reasonHint) {
        reasonHint.textContent = `AI Recommendation (${result.data.recommended_member_name}): ${result.data.reason}`;
      }
      showNotification(`AI suggests assigning to ${result.data.recommended_member_name}`, 'success');
    } else {
      if (reasonHint) reasonHint.textContent = '';
      showNotification(result.message || 'AI recommendation failed.', 'error');
    }
  } catch (error) {
    console.error('Error getting AI assignee suggestion:', error);
    if (reasonHint) reasonHint.textContent = '';
    showNotification('Failed to contact AI recommendation service.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI Suggest';
  }
}

// Get AI recommendation for a single task row in the AI Recommendation column
async function getTaskAiRecommendation(taskId) {
  const task = allTasks.find((t) => t.task_id === taskId);
  if (!task) return;

  aiRecommendations[taskId] = { loading: true };
  filterTasks();

  try {
    const response = await fetch('/api/ai/recommend-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        priority: task.priority,
        deadline: task.deadline,
        current_assigned_to: task.assigned_to,
      }),
    });
    const result = await response.json();

    if (result.success && result.data) {
      aiRecommendations[taskId] = result.data;
    } else {
      delete aiRecommendations[taskId];
      showNotification(result.message || 'Failed to get AI recommendation.', 'error');
    }
  } catch (error) {
    console.error('Error fetching AI recommendation for task:', error);
    delete aiRecommendations[taskId];
    showNotification('Error contacting AI recommendation service.', 'error');
  }

  filterTasks();
}

// Get AI recommendations for all tasks at once
async function recommendAllTasks() {
  const btn = document.getElementById('btn-recommend-all');
  if (allTasks.length === 0) {
    showNotification('No tasks available to analyze.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Analyzing...';

  try {
    const response = await fetch('/api/ai/recommend-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      result.data.forEach((rec) => {
        aiRecommendations[rec.task_id] = rec;
      });
      filterTasks();
      showNotification('AI recommendations generated for all tasks!', 'success');
    } else {
      showNotification(result.message || 'Failed to generate AI recommendations.', 'error');
    }
  } catch (error) {
    console.error('Error generating bulk AI recommendations:', error);
    showNotification('Error contacting AI service.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI Recommend All';
  }
}

// Apply the AI recommended member directly to the task
async function applyAiRecommendation(taskId) {
  const task = allTasks.find((t) => t.task_id === taskId);
  const rec = aiRecommendations[taskId];
  if (!task || !rec) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        assigned_to: rec.recommended_member_id,
        priority: task.priority,
        deadline: task.deadline ? task.deadline.split('T')[0] : null,
        status: task.status,
      }),
    });
    const result = await response.json();

    if (result.success) {
      showNotification(`Task #${taskId} assigned to ${rec.recommended_member_name}!`, 'success');
      await loadTasks();
      await loadStats();
      await loadMembers();
      filterTasks();
    } else {
      showNotification(result.message || 'Failed to apply AI assignment.', 'error');
    }
  } catch (error) {
    console.error('Error applying AI recommendation:', error);
    showNotification('Failed to apply AI assignment.', 'error');
  }
}

// Load overall AI Teamwork Insights on the Dashboard
async function loadAiTeamInsights() {
  const btn = document.getElementById('btn-ai-insights');
  const container = document.getElementById('ai-insights-content');
  if (!btn || !container) return;

  btn.disabled = true;
  btn.textContent = 'Analyzing...';
  container.innerHTML = '<p class="ai-placeholder-text">Generating AI teamwork recommendations...</p>';

  try {
    const response = await fetch('/api/ai/team-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();

    if (result.success && result.data) {
      const summary = escapeHtml(result.data.summary || '');
      const tips = Array.isArray(result.data.tips) ? result.data.tips : [];
      container.innerHTML = `
        <p class="ai-summary-text">${summary}</p>
        <ul class="ai-tips-list">
          ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}
        </ul>
      `;
    } else {
      container.innerHTML = `<p class="ai-placeholder-text" style="color:#dc2626;">${escapeHtml(result.message || 'Could not generate AI insights.')}</p>`;
    }
  } catch (error) {
    console.error('Error loading AI team insights:', error);
    container.innerHTML = '<p class="ai-placeholder-text" style="color:#dc2626;">Error contacting AI service.</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyze Team Workload (AI)';
  }
}

// Expose functions globally for HTML event handlers
window.switchPage = switchPage;
window.handleCreateTask = handleCreateTask;
window.handleUpdateTask = handleUpdateTask;
window.handleDeleteTask = handleDeleteTask;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.quickUpdateStatus = quickUpdateStatus;
window.handleCreateMember = handleCreateMember;
window.filterTasks = filterTasks;
window.suggestAssigneeForNewTask = suggestAssigneeForNewTask;
window.getTaskAiRecommendation = getTaskAiRecommendation;
window.recommendAllTasks = recommendAllTasks;
window.applyAiRecommendation = applyAiRecommendation;
window.loadAiTeamInsights = loadAiTeamInsights;


