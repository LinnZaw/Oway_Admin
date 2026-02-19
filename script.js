const stats = [
  { label: 'Active Drivers', value: 142, tone: 'warning' },
  { label: 'Online 3-Wheelers', value: 118, tone: 'light' },
  { label: 'Completed Trips Today', value: 1864, tone: 'success' },
  { label: 'Open Support Tickets', value: 23, tone: 'danger' }
];

const liveTrips = [
  { id: 'TR-5021', driver: 'Kamal Perera', vehicle: 'TW-4821', status: 'In Progress', eta: '08 min' },
  { id: 'TR-5022', driver: 'Nuwan Silva', vehicle: 'TW-3094', status: 'Picking Up', eta: '03 min' },
  { id: 'TR-5023', driver: 'Rizwan Ali', vehicle: 'TW-7740', status: 'Delayed', eta: '14 min' },
  { id: 'TR-5024', driver: 'Sanjeewa Fernando', vehicle: 'TW-6252', status: 'In Progress', eta: '11 min' }
];

const AUTH_KEY = 'oway_admin_logged_in';
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');

function renderStats() {
  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = stats.map(item => `
    <div class="col-12 col-sm-6 col-xl-3">
      <div class="panel stat-card p-3 bg-${item.tone}-subtle border-0">
        <div class="label">${item.label}</div>
        <div class="value">${item.value.toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}

function statusBadge(status) {
  switch (status) {
    case 'In Progress':
      return 'bg-warning text-dark';
    case 'Picking Up':
      return 'bg-info text-dark';
    case 'Delayed':
      return 'bg-danger';
    default:
      return 'bg-secondary';
  }
}

function renderTrips() {
  const body = document.getElementById('tripTableBody');
  body.innerHTML = liveTrips.map(trip => `
    <tr>
      <td class="fw-semibold">${trip.id}</td>
      <td>${trip.driver}</td>
      <td>${trip.vehicle}</td>
      <td><span class="badge status ${statusBadge(trip.status)}">${trip.status}</span></td>
      <td>${trip.eta}</td>
    </tr>
  `).join('');
}

function sendAlert() {
  alert('Fleet alert sent to all active 3-wheeler drivers.');
}

function assignVehicle() {
  alert('Backup 3-wheeler has been assigned to pending high-priority trip.');
}

function downloadReport() {
  alert('Daily operations report downloaded.');
}

function refreshDashboard() {
  const randomIndex = Math.floor(Math.random() * liveTrips.length);
  const eta = `${Math.floor(Math.random() * 12 + 2)} min`;
  liveTrips[randomIndex].eta = eta;
  renderTrips();
}

function showDashboard() {
  loginView.classList.add('d-none');
  dashboardView.classList.remove('d-none');
  renderStats();
  renderTrips();
}

function showLogin() {
  dashboardView.classList.add('d-none');
  loginView.classList.remove('d-none');
}

function login(username, password) {
  if (!username || !password) {
    return false;
  }

  localStorage.setItem(AUTH_KEY, 'true');
  return true;
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  showLogin();
  loginForm.reset();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (login(username, password)) {
    loginError.classList.add('d-none');
    showDashboard();
    return;
  }

  loginError.classList.remove('d-none');
});

refreshBtn.addEventListener('click', refreshDashboard);
logoutBtn.addEventListener('click', logout);

if (localStorage.getItem(AUTH_KEY) === 'true') {
  showDashboard();
} else {
  showLogin();
}

window.sendAlert = sendAlert;
window.assignVehicle = assignVehicle;
window.downloadReport = downloadReport;
