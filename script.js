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

const exampleVehicleData = [
  {
    plateNumber: 'WP-TW-4832',
    contact: '+94 77 123 4567',
    status: 'Available',
    address: 'Town Hall, Colombo 07'
  },
  {
    plateNumber: 'CP-TW-9921',
    contact: '+94 71 987 2210',
    status: 'On Trip',
    address: 'Peradeniya Road, Kandy'
  },
  {
    plateNumber: 'SP-TW-1154',
    contact: '+94 75 445 7788',
    status: 'Offline',
    address: 'Matara Bus Stand, Matara'
  }
];

const SPRING_BOOT_API_URL = 'http://localhost:8080/api/vehicles';

const AUTH_KEY = 'oway_admin_logged_in';
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const dashboardPage = document.getElementById('dashboardPage');
const vehiclesPage = document.getElementById('vehiclesPage');
const dashboardNav = document.getElementById('dashboardNav');
const vehiclesNav = document.getElementById('vehiclesNav');
const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
const vehicleTableBody = document.getElementById('vehicleTableBody');
const vehicleApiNotice = document.getElementById('vehicleApiNotice');
const loadVehiclesBtn = document.getElementById('loadVehiclesBtn');

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

function vehicleStatusBadge(status) {
  switch (status) {
    case 'Available':
      return 'bg-success';
    case 'On Trip':
      return 'bg-warning text-dark';
    case 'Offline':
      return 'bg-secondary';
    default:
      return 'bg-info text-dark';
  }
}

function renderVehicles(vehicles) {
  vehicleTableBody.innerHTML = vehicles.map(vehicle => `
    <tr>
      <td class="fw-semibold">${vehicle.plateNumber}</td>
      <td>${vehicle.contact}</td>
      <td><span class="badge ${vehicleStatusBadge(vehicle.status)}">${vehicle.status}</span></td>
      <td>${vehicle.address}</td>
    </tr>
  `).join('');
}

async function loadVehiclesFromApi() {
  vehicleApiNotice.className = 'alert alert-info py-2 px-3 small mb-3';
  vehicleApiNotice.textContent = `Loading vehicles from ${SPRING_BOOT_API_URL} ...`;

  try {
    const response = await fetch(SPRING_BOOT_API_URL);
    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const vehicles = await response.json();
    renderVehicles(vehicles);
    vehicleApiNotice.className = 'alert alert-success py-2 px-3 small mb-3';
    vehicleApiNotice.textContent = `Loaded ${vehicles.length} vehicles from Spring Boot API.`;
  } catch (error) {
    renderVehicles(exampleVehicleData);
    vehicleApiNotice.className = 'alert alert-warning py-2 px-3 small mb-3';
    vehicleApiNotice.textContent = `Could not reach API. Showing example list data. (${error.message})`;
  }
}

function showDashboardPage() {
  dashboardPage.classList.remove('d-none');
  vehiclesPage.classList.add('d-none');
  dashboardNav.classList.add('active');
  vehiclesNav.classList.remove('active');
  pageTitle.textContent = 'O_way Admin Overview';
  pageDescription.textContent = 'Manage your yellow 3-wheeler ride network in one place.';
  refreshBtn.classList.remove('d-none');
}

function showVehiclesPage() {
  dashboardPage.classList.add('d-none');
  vehiclesPage.classList.remove('d-none');
  dashboardNav.classList.remove('active');
  vehiclesNav.classList.add('active');
  pageTitle.textContent = 'Vehicles';
  pageDescription.textContent = 'View live fleet vehicle details and status from the backend service.';
  refreshBtn.classList.add('d-none');
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
  renderVehicles(exampleVehicleData);
  vehicleApiNotice.className = 'alert alert-secondary py-2 px-3 small mb-3';
  vehicleApiNotice.textContent = 'Showing example list data. Click "Load Vehicles from Spring Boot API" to fetch live data.';
  showDashboardPage();
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

dashboardNav.addEventListener('click', (event) => {
  event.preventDefault();
  showDashboardPage();
});

vehiclesNav.addEventListener('click', (event) => {
  event.preventDefault();
  showVehiclesPage();
});

refreshBtn.addEventListener('click', refreshDashboard);
logoutBtn.addEventListener('click', logout);
loadVehiclesBtn.addEventListener('click', loadVehiclesFromApi);

if (localStorage.getItem(AUTH_KEY) === 'true') {
  showDashboard();
} else {
  showLogin();
}

window.sendAlert = sendAlert;
window.assignVehicle = assignVehicle;
window.downloadReport = downloadReport;
