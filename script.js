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
    if (target === 'students')   loadStudents();
    if (target === 'add-student') loadBatches();
    if (target === 'attendance') { loadAttendance(); loadAttStudents(); loadAttBatches(); }
    if (target === 'placement')  loadPlacements();
    if (target === 'batches')    loadBatchList();
  });
});

// ===================== STUDENTS =====================

const grid      = document.getElementById('students-grid');
const loadingEl = document.getElementById('students-loading');
const errorEl   = document.getElementById('students-error');

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

  const viewEl   = card.querySelector('.card-view');
  const editEl   = card.querySelector('.card-edit');
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
  card.querySelector('.btn-delete').addEventListener('click', () =>
    deleteStudent(student.Student_ID, card)
  );
  return card;
}

async function populateEditBatch(selectEl, currentBatchId) {
  if (selectEl.dataset.loaded) { selectEl.value = currentBatchId || ''; return; }
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
  } catch (err) { console.error('Could not load batches for edit:', err); }
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
    showToast('Please fill in all required fields.', 'error'); return;
  }
  const saveBtn = editEl.querySelector('.btn-save-edit');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  try {
    const updated = await request(`/students/${studentId}`, { method: 'PUT', body: JSON.stringify(payload) });
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
    saveBtn.disabled = false; saveBtn.textContent = 'Save';
  }
}

async function deleteStudent(studentId, cardEl) {
  if (!confirm('Are you sure you want to delete this student?')) return;
  try {
    await request(`/students/${studentId}`, { method: 'DELETE' });
    cardEl.remove();
    showToast('Student deleted successfully.', 'success');
    if (!grid.querySelector('.student-card'))
      grid.innerHTML = '<p class="empty-state">No students found.</p>';
  } catch (err) { showToast(`Failed to delete: ${err.message}`, 'error'); }
}

function renderStudents(students) {
  grid.innerHTML = '';
  if (!students.length) { grid.innerHTML = '<p class="empty-state">No students found.</p>'; return; }
  students.forEach(s => grid.appendChild(buildStudentCard(s)));
}

async function loadStudents(name = '') {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  grid.innerHTML = '';
  const endpoint = name ? `/students/search?name=${encodeURIComponent(name)}` : '/students';
  try {
    const students = await request(endpoint);
    renderStudents(students);
  } catch (err) {
    errorEl.textContent = `Failed to load students: ${err.message}`;
    errorEl.classList.remove('hidden');
  } finally { loadingEl.classList.add('hidden'); }
}

document.getElementById('btn-search').addEventListener('click', () =>
  loadStudents(document.getElementById('search-name').value.trim())
);
document.getElementById('search-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadStudents(e.target.value.trim());
});
document.getElementById('btn-clear-search').addEventListener('click', () => {
  document.getElementById('search-name').value = '';
  loadStudents();
});

// ===================== ADD STUDENT =====================

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
  } catch (err) { console.error('Could not load batches:', err); }
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
    formError.classList.remove('hidden'); return;
  }
  submitBtn.disabled = true; submitBtn.textContent = 'Adding…';
  try {
    const created = await request('/students', { method: 'POST', body: JSON.stringify(payload) });
    showToast(`Student ${created.Student_ID} added successfully!`, 'success');
    form.reset(); batchSelect.value = '';
  } catch (err) {
    formError.textContent = `Error: ${err.message}`;
    formError.classList.remove('hidden');
    showToast(err.message, 'error');
  } finally { submitBtn.disabled = false; submitBtn.textContent = 'Add Student'; }
});

// ===================== ATTENDANCE =====================

const attLoading = document.getElementById('attendance-loading');
const attError   = document.getElementById('attendance-error');
const attTable   = document.getElementById('attendance-table-wrap');
const attTbody   = document.getElementById('attendance-tbody');
const attEmpty   = document.getElementById('attendance-empty');

function pctClass(pct) {
  if (pct >= 75) return 'pct-high';
  if (pct >= 50) return 'pct-mid';
  return 'pct-low';
}

async function loadAttStudents() {
  const sel = document.getElementById('att-student');
  if (sel.dataset.loaded) return;
  try {
    const students = await request('/students');
    sel.innerHTML = '<option value="">-- Select Student --</option>';
    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.Student_ID;
      opt.textContent = `${s.First_Name} ${s.Last_Name}`;
      sel.appendChild(opt);
    });
    sel.dataset.loaded = '1';
  } catch (err) { console.error('Could not load students for attendance:', err); }
}

async function loadAttBatches() {
  const sel = document.getElementById('att-batch');
  if (sel.dataset.loaded) return;
  try {
    const batches = await request('/batches');
    sel.innerHTML = '<option value="">-- Select Batch --</option>';
    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.Batch_ID;
      opt.textContent = b.Batch_Name ? `${b.Batch_ID} — ${b.Batch_Name}` : b.Batch_ID;
      sel.appendChild(opt);
    });
    sel.dataset.loaded = '1';
  } catch (err) { console.error('Could not load batches for attendance:', err); }
}

async function loadAttendance() {
  attLoading.classList.remove('hidden');
  attError.classList.add('hidden');
  attTable.classList.add('hidden');
  attEmpty.classList.add('hidden');
  try {
    const rows = await request('/attendance/summary');
    if (!rows.length) { attEmpty.classList.remove('hidden'); return; }
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
  } finally { attLoading.classList.add('hidden'); }
}

document.getElementById('btn-refresh-attendance').addEventListener('click', loadAttendance);

document.getElementById('btn-mark-att').addEventListener('click', async () => {
  const errEl    = document.getElementById('att-mark-error');
  const studentId = document.getElementById('att-student').value;
  const batchId   = document.getElementById('att-batch').value;
  const date      = document.getElementById('att-date').value;
  const status    = document.getElementById('att-status').value;
  errEl.classList.add('hidden');

  if (!studentId || !batchId || !date) {
    errEl.textContent = 'Please select student, batch, and date.';
    errEl.classList.remove('hidden'); return;
  }

  try {
    await request('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify({ Student_ID: parseInt(studentId), Batch_ID: batchId, Date: date, Status: status }),
    });
    showToast('Attendance marked successfully.', 'success');
    // Reset cache so summary refreshes
    delete document.getElementById('att-student').dataset.loaded;
    loadAttendance();
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
    errEl.classList.remove('hidden');
  }
});

// ===================== PLACEMENTS =====================

let placementStudents = [];

async function loadPlacementStudents() {
  const sel = document.getElementById('p-student');
  if (placementStudents.length) return;
  try {
    placementStudents = await request('/students');
    sel.innerHTML = '<option value="">-- Select Student --</option>';
    placementStudents.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.Student_ID;
      opt.textContent = `${s.First_Name} ${s.Last_Name} (ID: ${s.Student_ID})`;
      sel.appendChild(opt);
    });
  } catch (err) { console.error('Could not load students for placement:', err); }
}

function getStudentName(id) {
  const s = placementStudents.find(s => s.Student_ID === id);
  return s ? `${s.First_Name} ${s.Last_Name}` : `ID ${id}`;
}

async function loadPlacements() {
  const loading = document.getElementById('placement-loading');
  const errEl   = document.getElementById('placement-error');
  const wrap    = document.getElementById('placement-table-wrap');
  const tbody   = document.getElementById('placement-tbody');
  const empty   = document.getElementById('placement-empty');

  loading.classList.remove('hidden');
  errEl.classList.add('hidden');
  wrap.classList.add('hidden');
  empty.classList.add('hidden');

  await loadPlacementStudents();

  try {
    const rows = await request('/placements');
    if (!rows.length) { empty.classList.remove('hidden'); return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${getStudentName(r.Student_ID)}</td>
        <td>${r.Company_Name || '-'}</td>
        <td>${r.Job_Title || '-'}</td>
        <td>${r.Annual_Package ? '₹' + Number(r.Annual_Package).toLocaleString('en-IN') : '-'}</td>
        <td>${r.Offer_Date || '-'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editPlacement('${r.Placement_ID}','${r.Student_ID}','${r.Company_Name || ''}','${r.Job_Title || ''}','${r.Annual_Package || ''}','${r.Offer_Date || ''}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePlacement('${r.Placement_ID}')">Delete</button>
        </td>
      </tr>
    `).join('');
    wrap.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = `Failed to load placements: ${err.message}`;
    errEl.classList.remove('hidden');
  } finally { loading.classList.add('hidden'); }
}

document.getElementById('btn-add-placement').addEventListener('click', () => {
  document.getElementById('placement-form-title').textContent = 'Add Placement';
  document.getElementById('p-placement-id').value = '';
  document.getElementById('p-student').value = '';
  document.getElementById('p-company').value = '';
  document.getElementById('p-jobtitle').value = '';
  document.getElementById('p-package').value = '';
  document.getElementById('p-offerdate').value = '';
  document.getElementById('p-student').disabled = false;
  document.getElementById('placement-form-error').classList.add('hidden');
  document.getElementById('placement-form-wrap').classList.remove('hidden');
  loadPlacementStudents();
});

document.getElementById('btn-cancel-placement').addEventListener('click', () => {
  document.getElementById('placement-form-wrap').classList.add('hidden');
});

function editPlacement(id, studentId, company, jobTitle, pkg, offerDate) {
  document.getElementById('placement-form-title').textContent = 'Edit Placement';
  document.getElementById('p-placement-id').value = id;
  document.getElementById('p-student').value = studentId;
  document.getElementById('p-student').disabled = true;
  document.getElementById('p-company').value = company;
  document.getElementById('p-jobtitle').value = jobTitle;
  document.getElementById('p-package').value = pkg;
  document.getElementById('p-offerdate').value = offerDate;
  document.getElementById('placement-form-error').classList.add('hidden');
  document.getElementById('placement-form-wrap').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btn-save-placement').addEventListener('click', async () => {
  const errEl       = document.getElementById('placement-form-error');
  const placementId = document.getElementById('p-placement-id').value;
  const studentId   = document.getElementById('p-student').value;
  const company     = document.getElementById('p-company').value.trim();
  const jobTitle    = document.getElementById('p-jobtitle').value.trim();
  const pkg         = document.getElementById('p-package').value;
  const offerDate   = document.getElementById('p-offerdate').value;
  errEl.classList.add('hidden');

  if (!company || !jobTitle) {
    errEl.textContent = 'Company name and job title are required.';
    errEl.classList.remove('hidden'); return;
  }

  const body = {
    Company_Name: company,
    Job_Title: jobTitle,
    Annual_Package: pkg ? parseFloat(pkg) : null,
    Offer_Date: offerDate || null,
  };

  try {
    if (placementId) {
      await request(`/placements/${placementId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Placement updated.', 'success');
    } else {
      if (!studentId) {
        errEl.textContent = 'Please select a student.';
        errEl.classList.remove('hidden'); return;
      }
      await request('/placements', { method: 'POST', body: JSON.stringify({ ...body, Student_ID: parseInt(studentId) }) });
      showToast('Placement added.', 'success');
    }
    document.getElementById('placement-form-wrap').classList.add('hidden');
    loadPlacements();
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
    errEl.classList.remove('hidden');
  }
});

async function deletePlacement(id) {
  if (!confirm('Delete this placement record?')) return;
  try {
    await request(`/placements/${id}`, { method: 'DELETE' });
    showToast('Placement deleted.', 'success');
    loadPlacements();
  } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
}

// ===================== BATCH MANAGEMENT =====================

async function loadBatchList() {
  const loading = document.getElementById('batch-loading');
  const errEl   = document.getElementById('batch-error');
  const wrap    = document.getElementById('batch-table-wrap');
  const tbody   = document.getElementById('batch-tbody');
  const empty   = document.getElementById('batch-empty');

  loading.classList.remove('hidden');
  errEl.classList.add('hidden');
  wrap.classList.add('hidden');
  empty.classList.add('hidden');

  try {
    const batches = await request('/batches');
    if (!batches.length) { empty.classList.remove('hidden'); return; }
    tbody.innerHTML = batches.map(b => `
      <tr>
        <td>${b.Batch_ID}</td>
        <td>${b.Batch_Name}</td>
        <td>${b.Instructor_Name || '-'}</td>
        <td>${b.Start_Date || '-'}</td>
        <td>${b.End_Date || '-'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editBatch('${b.Batch_ID}','${b.Batch_Name}','${b.Instructor_Name || ''}','${b.Start_Date || ''}','${b.End_Date || ''}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBatch('${b.Batch_ID}')">Delete</button>
        </td>
      </tr>
    `).join('');
    wrap.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = `Failed to load batches: ${err.message}`;
    errEl.classList.remove('hidden');
  } finally { loading.classList.add('hidden'); }
}

document.getElementById('btn-add-batch').addEventListener('click', () => {
  document.getElementById('batch-form-title').textContent = 'Add Batch';
  document.getElementById('b-batch-id-hidden').value = '';
  document.getElementById('b-id').value = '';
  document.getElementById('b-id').disabled = false;
  document.getElementById('b-name').value = '';
  document.getElementById('b-instructor').value = '';
  document.getElementById('b-start').value = '';
  document.getElementById('b-end').value = '';
  document.getElementById('batch-form-error').classList.add('hidden');
  document.getElementById('batch-form-wrap').classList.remove('hidden');
});

document.getElementById('btn-cancel-batch').addEventListener('click', () => {
  document.getElementById('batch-form-wrap').classList.add('hidden');
});

function editBatch(id, name, instructor, start, end) {
  document.getElementById('batch-form-title').textContent = 'Edit Batch';
  document.getElementById('b-batch-id-hidden').value = id;
  document.getElementById('b-id').value = id;
  document.getElementById('b-id').disabled = true;
  document.getElementById('b-name').value = name;
  document.getElementById('b-instructor').value = instructor;
  document.getElementById('b-start').value = start;
  document.getElementById('b-end').value = end;
  document.getElementById('batch-form-error').classList.add('hidden');
  document.getElementById('batch-form-wrap').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btn-save-batch').addEventListener('click', async () => {
  const errEl   = document.getElementById('batch-form-error');
  const editId  = document.getElementById('b-batch-id-hidden').value;
  const batchId = document.getElementById('b-id').value.trim();
  const name    = document.getElementById('b-name').value.trim();
  const instr   = document.getElementById('b-instructor').value.trim();
  const start   = document.getElementById('b-start').value;
  const end     = document.getElementById('b-end').value;
  errEl.classList.add('hidden');

  if (!batchId || !name) {
    errEl.textContent = 'Batch ID and Batch Name are required.';
    errEl.classList.remove('hidden'); return;
  }

  const body = {
    Batch_Name: name,
    Instructor_Name: instr || null,
    Start_Date: start || null,
    End_Date: end || null,
  };

  try {
    if (editId) {
      await request(`/batches/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Batch updated.', 'success');
    } else {
      await request('/batches', { method: 'POST', body: JSON.stringify({ Batch_ID: batchId, ...body }) });
      showToast('Batch added.', 'success');
    }
    document.getElementById('batch-form-wrap').classList.add('hidden');
    loadBatchList();
  } catch (err) {
    errEl.textContent = `Error: ${err.message}`;
    errEl.classList.remove('hidden');
  }
});

async function deleteBatch(id) {
  if (!confirm(`Delete batch "${id}"? This cannot be undone.`)) return;
  try {
    await request(`/batches/${id}`, { method: 'DELETE' });
    showToast('Batch deleted.', 'success');
    loadBatchList();
  } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
}

// ===================== INIT =====================
loadStudents();
loadBatches();
