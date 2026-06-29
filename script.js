// Local dev → http://localhost:8000
// Production → set window.API_BASE in a <script> tag, or replace this URL after deploy
const API_BASE = window.API_BASE || 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(body.detail)
      ? body.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
      : body.detail || `HTTP ${res.status}`;
    throw new Error(detail);
  }

  return res.json();
}

// --- Toast ---

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// --- Tab navigation ---

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels  = document.querySelectorAll('.tab-panel');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabButtons.forEach(b => b.classList.toggle('active', b === btn));
    tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));

    if (target === 'students')    loadStudents();
    if (target === 'add-student') loadBatches();
    if (target === 'attendance')  loadAttendance();
  });
});

// --- Students tab ---

const grid           = document.getElementById('students-grid');
const loadingEl      = document.getElementById('students-loading');
const errorEl        = document.getElementById('students-error');

function buildStudentCard(student) {
  const initials = (student.First_Name[0] + student.Last_Name[0]).toUpperCase();

  const card = document.createElement('div');
  card.className = 'student-card';

  card.innerHTML = `
    <div class="card-actions">
      <button class="btn-edit" title="Edit student">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-delete" title="Delete student">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>

    <div class="card-view">
      <div class="card-avatar">${initials}</div>
      <div class="card-name">${student.First_Name} ${student.Last_Name}</div>
      <div class="card-meta">
        <span>🆔 ${student.Student_ID}</span>
        ${student.Batch_ID      ? `<span>📚 ${student.Batch_ID}</span>`      : ''}
        ${student.Email_Address ? `<span>✉️ ${student.Email_Address}</span>` : ''}
        ${student.Phone_Number  ? `<span>📞 ${student.Phone_Number}</span>`  : ''}
      </div>
      ${student.Batch_ID ? `<span class="badge">${student.Batch_ID}</span>` : ''}
    </div>

    <div class="card-edit hidden">
      <div class="edit-row">
        <input class="edit-input" name="First_Name" placeholder="First Name" value="${student.First_Name}" />
        <input class="edit-input" name="Last_Name" placeholder="Last Name" value="${student.Last_Name}" />
      </div>
      <input class="edit-input" name="Email_Address" placeholder="Email" value="${student.Email_Address || ''}" />
      <input class="edit-input" name="Phone_Number" placeholder="Phone" value="${student.Phone_Number || ''}" />
      <select class="edit-input edit-batch" name="Batch_ID"></select>
      <div class="edit-actions">
        <button class="btn btn-ghost btn-cancel-edit">Cancel</button>
        <button class="btn btn-primary btn-save-edit">Save</button>
      </div>
    </div>
  `;

  const viewEl  = card.querySelector('.card-view');
  const editEl  = card.querySelector('.card-edit');
  const batchSel = card.querySelector('.edit-batch');

  card.querySelector('.btn-edit').addEventListener('click', () => {
    populateEditBatch(batchSel, student.Batch_ID);
    viewEl.classList.add('hidden');
    editEl.classList.remove('hidden');
  });

  card.querySelector('.btn-cancel-edit').addEventListener('click', () => {
    viewEl.classList.remove('hidden');
    editEl.classList.add('hidden');
  });

  card.querySelector('.btn-save-edit').addEventListener('click', () =>
    saveStudent(student.Student_ID, card, viewEl, editEl)
  );

  card.querySelector('.btn-delete').addEventListener('click', () => deleteStudent(student.Student_ID, card));

  return card;
}

async function populateEditBatch(selectEl, currentBatchId) {
  if (selectEl.dataset.loaded) {
    selectEl.value = currentBatchId || '';
    return;
  }
  try {
    const batches = await request('/batches');
    selectEl.innerHTML = '<option value="">-- Select Batch --</option>';
    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.Batch_ID;
      opt.textContent = b.Batch_Name ? `${b.Batch_ID} — ${b.Batch_Name}` : b.Batch_ID;
      if (b.Batch_ID === currentBatchId) opt.selected = true;
      selectEl.appendChild(opt);
    });
    selectEl.dataset.loaded = '1';
  } catch (err) {
    console.error('Could not load batches for edit:', err);
  }
}

async function saveStudent(studentId, card, viewEl, editEl) {
  const payload = {
    First_Name:    editEl.querySelector('[name=First_Name]').value.trim(),
    Last_Name:     editEl.querySelector('[name=Last_Name]').value.trim(),
    Email_Address: editEl.querySelector('[name=Email_Address]').value.trim(),
    Phone_Number:  editEl.querySelector('[name=Phone_Number]').value.trim(),
    Batch_ID:      editEl.querySelector('[name=Batch_ID]').value || null,
  };

  if (!payload.First_Name || !payload.Last_Name || !payload.Email_Address || !payload.Phone_Number) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  const saveBtn = editEl.querySelector('.btn-save-edit');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const updated = await request(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const newInitials = (updated.First_Name[0] + updated.Last_Name[0]).toUpperCase();
    viewEl.querySelector('.card-avatar').textContent = newInitials;
    viewEl.querySelector('.card-name').textContent = `${updated.First_Name} ${updated.Last_Name}`;
    viewEl.querySelector('.card-meta').innerHTML = `
      <span>🆔 ${updated.Student_ID}</span>
      ${updated.Batch_ID      ? `<span>📚 ${updated.Batch_ID}</span>`      : ''}
      ${updated.Email_Address ? `<span>✉️ ${updated.Email_Address}</span>` : ''}
      ${updated.Phone_Number  ? `<span>📞 ${updated.Phone_Number}</span>`  : ''}
    `;
    const badge = viewEl.querySelector('.badge');
    if (badge) badge.textContent = updated.Batch_ID || '';

    viewEl.classList.remove('hidden');
    editEl.classList.add('hidden');
    showToast('Student updated successfully.', 'success');
  } catch (err) {
    showToast(`Failed to update: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function deleteStudent(studentId, cardEl) {
  if (!confirm('Are you sure you want to delete this student?')) return;
  try {
    await request(`/students/${studentId}`, { method: 'DELETE' });
    cardEl.remove();
    showToast('Student deleted successfully.', 'success');
    if (!grid.querySelector('.student-card')) {
      grid.innerHTML = '<p class="empty-state">No students found.</p>';
    }
  } catch (err) {
    showToast(`Failed to delete: ${err.message}`, 'error');
  }
}

function renderStudents(students) {
  grid.innerHTML = '';

  if (!students.length) {
    grid.innerHTML = '<p class="empty-state">No students found.</p>';
    return;
  }

  students.forEach(s => grid.appendChild(buildStudentCard(s)));
}

async function loadStudents(name = '') {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  grid.innerHTML = '';

  const endpoint = name
    ? `/students/search?name=${encodeURIComponent(name)}`
    : '/students';

  try {
    const students = await request(endpoint);
    renderStudents(students);
  } catch (err) {
    errorEl.textContent = `Failed to load students: ${err.message}`;
    errorEl.classList.remove('hidden');
    console.error(err);
  } finally {
    loadingEl.classList.add('hidden');
  }
}

document.getElementById('btn-search').addEventListener('click', () => {
  loadStudents(document.getElementById('search-name').value.trim());
});

document.getElementById('search-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadStudents(e.target.value.trim());
});

document.getElementById('btn-clear-search').addEventListener('click', () => {
  document.getElementById('search-name').value = '';
  loadStudents();
});

// --- Add student tab ---

const form        = document.getElementById('add-student-form');
const formError   = document.getElementById('form-error');
const submitBtn   = document.getElementById('btn-add');
const batchSelect = document.getElementById('f-batch');

async function loadBatches() {
  try {
    const batches = await request('/batches');
    batchSelect.innerHTML = '<option value="">-- Select Batch --</option>';
    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.Batch_ID;
      opt.textContent = b.Batch_Name ? `${b.Batch_ID} — ${b.Batch_Name}` : b.Batch_ID;
      batchSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Could not load batches:', err);
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  formError.classList.add('hidden');

  const payload = {
    First_Name:    form.First_Name.value.trim(),
    Last_Name:     form.Last_Name.value.trim(),
    Batch_ID:      form.Batch_ID.value || null,
    Email_Address: form.Email_Address.value.trim(),
    Phone_Number:  form.Phone_Number.value.trim(),
  };

  const missing = Object.entries(payload)
    .filter(([k, v]) => k !== 'Batch_ID' && !v)
    .map(([k]) => k.replace(/_/g, ' '));

  if (missing.length) {
    formError.textContent = `Please fill in: ${missing.join(', ')}`;
    formError.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding…';

  try {
    const created = await request('/students', { method: 'POST', body: JSON.stringify(payload) });
    showToast(`Student ${created.Student_ID} added successfully!`, 'success');
    form.reset();
    batchSelect.value = '';
  } catch (err) {
    formError.textContent = `Error: ${err.message}`;
    formError.classList.remove('hidden');
    showToast(err.message, 'error');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Student';
  }
});

// --- Attendance tab ---

const attLoading  = document.getElementById('attendance-loading');
const attError    = document.getElementById('attendance-error');
const attTable    = document.getElementById('attendance-table-wrap');
const attTbody    = document.getElementById('attendance-tbody');
const attEmpty    = document.getElementById('attendance-empty');

function pctClass(pct) {
  if (pct >= 75) return 'pct-high';
  if (pct >= 50) return 'pct-mid';
  return 'pct-low';
}

async function loadAttendance() {
  attLoading.classList.remove('hidden');
  attError.classList.add('hidden');
  attTable.classList.add('hidden');
  attEmpty.classList.add('hidden');

  try {
    const rows = await request('/attendance/summary');

    if (!rows.length) {
      attEmpty.classList.remove('hidden');
      return;
    }

    attTbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.Student_ID}</td>
        <td>${r.Name}</td>
        <td>${r.total_classes}</td>
        <td>${r.present}</td>
        <td>${r.absent}</td>
        <td class="${pctClass(r.attendance_percent)}">${r.attendance_percent}%</td>
      </tr>
    `).join('');

    attTable.classList.remove('hidden');
  } catch (err) {
    attError.textContent = `Failed to load attendance: ${err.message}`;
    attError.classList.remove('hidden');
    console.error(err);
  } finally {
    attLoading.classList.add('hidden');
  }
}

document.getElementById('btn-refresh-attendance').addEventListener('click', loadAttendance);

// --- Init ---
loadStudents();
loadBatches();
