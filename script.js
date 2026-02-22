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

const LOGIN_API_URL = 'http://localhost:8000/api/auth/login';
const VEHICLE_API_URL = 'http://localhost:8000/api/admin/getVehicle';
const AUTH_COOKIE_KEY = 'oway_admin_token';

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
const vehicleSearchInput = document.getElementById('vehicleSearchInput');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

let allVehicles = [];

function renderStats() {
  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = stats.map((item) => `
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
  body.innerHTML = liveTrips.map((trip) => `
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
  const currentStatus = (status || '').toLowerCase();

  if (currentStatus.includes('available') || currentStatus.includes('active')) {
    return 'bg-success';
  }

  if (currentStatus.includes('trip') || currentStatus.includes('busy')) {
    return 'bg-warning text-dark';
  }

  if (currentStatus.includes('offline') || currentStatus.includes('inactive')) {
    return 'bg-secondary';
  }

  return 'bg-info text-dark';
}

function mapVehicle(rawVehicle) {
  return {
    plateNumber: rawVehicle.plateNumber || rawVehicle.vehiclePlateNumber || rawVehicle.plateNo || 'N/A',
    contact: rawVehicle.contact || rawVehicle.phone || rawVehicle.mobile || 'N/A',
    status: rawVehicle.status || rawVehicle.vehicleStatus || 'Unknown',
    address: rawVehicle.address || rawVehicle.currentAddress || rawVehicle.location || 'N/A'
  };
}

function setVehicleNotice(type, message) {
  vehicleApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  vehicleApiNotice.textContent = message;
}

function getCookie(name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie ? document.cookie.split('; ') : [];

  for (const cookie of cookies) {
    if (cookie.startsWith(encodedName)) {
      return decodeURIComponent(cookie.slice(encodedName.length));
    }
  }

  return null;
}

function setAuthCookie(token) {
  const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(AUTH_COOKIE_KEY)}=${encodeURIComponent(token)}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict${secureFlag}`;
}

function clearAuthCookie() {
  document.cookie = `${encodeURIComponent(AUTH_COOKIE_KEY)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
}

function getTokenFromResponse(responseBody) {
  return responseBody?.token
    || responseBody?.accessToken
    || responseBody?.jwt
    || responseBody?.data?.token
    || responseBody?.data?.accessToken
    || null;
}

function renderVehicles(vehicles) {
  if (!vehicles.length) {
    vehicleTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">No vehicles found.</td>
      </tr>
    `;
    return;
  }

  vehicleTableBody.innerHTML = vehicles.map((vehicle) => `
    <tr>
      <td class="fw-semibold">${vehicle.plateNumber}</td>
      <td>${vehicle.contact}</td>
      <td><span class="badge ${vehicleStatusBadge(vehicle.status)}">${vehicle.status}</span></td>
      <td>${vehicle.address}</td>
    </tr>
  `).join('');
}

function filterVehicleList() {
  const query = vehicleSearchInput.value.trim().toLowerCase();

  const filteredVehicles = allVehicles.filter((vehicle) => (
    vehicle.plateNumber.toLowerCase().includes(query)
      || vehicle.contact.toLowerCase().includes(query)
      || vehicle.status.toLowerCase().includes(query)
      || vehicle.address.toLowerCase().includes(query)
  ));

  renderVehicles(filteredVehicles);
}

async function loadVehiclesFromApi() {
  const token = getCookie(AUTH_COOKIE_KEY);

  if (!token) {
    setVehicleNotice('warning', 'Please log in again. Missing auth token.');
    showLogin();
    return;
  }

  setVehicleNotice('info', `Loading vehicles from ${VEHICLE_API_URL} ...`);

  try {
    const response = await fetch(VEHICLE_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const responseBody = await response.json();
    const list = Array.isArray(responseBody) ? responseBody : (responseBody.data || []);
    allVehicles = list.map(mapVehicle);

    filterVehicleList();
    setVehicleNotice('success', `Loaded ${allVehicles.length} vehicles from API.`);
  } catch (error) {
    allVehicles = [];
    renderVehicles([]);
    setVehicleNotice('danger', `Failed to load vehicles from API. ${error.message}`);
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
  pageDescription.textContent = 'Search and monitor live vehicle records from the admin API.';
  refreshBtn.classList.add('d-none');

  if (!allVehicles.length) {
    loadVehiclesFromApi();
  }
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
  renderVehicles([]);
  setVehicleNotice('info', 'Open Vehicles page to load data from API.');
  showDashboardPage();
}

function showLogin() {
  dashboardView.classList.add('d-none');
  loginView.classList.remove('d-none');
}

function setLoginLoadingState(isLoading) {
  loginSubmitBtn.disabled = isLoading;
  loginSubmitBtn.textContent = isLoading ? 'Logging in...' : 'Login';
}

async function login(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required.');
  }

  const response = await fetch(LOGIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  let responseBody = {};

  try {
    responseBody = await response.json();
  } catch {
    responseBody = {};
  }

  if (!response.ok) {
    const message = responseBody?.message || 'Invalid username or password.';
    throw new Error(message);
  }

  const token = getTokenFromResponse(responseBody);

  if (!token) {
    throw new Error('Login succeeded but no JWT token was returned by API.');
  }

  setAuthCookie(token);
}

function logout() {
  clearAuthCookie();
  showLogin();
  loginForm.reset();
  loginError.classList.add('d-none');
  setLoginLoadingState(false);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  setLoginLoadingState(true);

  try {
    await login(username, password);
    loginError.classList.add('d-none');
    showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove('d-none');
  } finally {
    setLoginLoadingState(false);
  }
});

dashboardNav.addEventListener('click', (event) => {
  event.preventDefault();
  showDashboardPage();
});

vehiclesNav.addEventListener('click', (event) => {
  event.preventDefault();
  showVehiclesPage();
});

vehicleSearchInput.addEventListener('input', filterVehicleList);
refreshBtn.addEventListener('click', refreshDashboard);
logoutBtn.addEventListener('click', logout);
loadVehiclesBtn.addEventListener('click', loadVehiclesFromApi);

if (getCookie(AUTH_COOKIE_KEY)) {
  showDashboard();
} else {
  showLogin();
}

window.sendAlert = sendAlert;
window.assignVehicle = assignVehicle;
window.downloadReport = downloadReport;
