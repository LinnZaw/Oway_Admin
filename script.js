// ================================
// Dashboard seed data (mock widgets)
// ================================
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

// ================================
// API endpoints and auth storage
// ================================
const LOGIN_API_URL = 'http://localhost:8000/api/auth/login';
const VEHICLE_API_URL = 'http://localhost:8000/api/admin/getVehicle';
const DELETE_VEHICLE_API_URL = 'http://localhost:8000/api/admin/deleteVehicle';
const ROLES_API_URL = 'http://localhost:8000/api/admin/getRoles';
const CREATE_ROLE_API_URL = 'http://localhost:8000/api/admin/roles';
const USERS_API_URL = 'http://localhost:8000/api/admin/getUser';
const PROFILES_API_URL = 'http://localhost:8000/api/admin/getProfiles';
const AUTH_STORAGE_KEY = 'oway_admin_token';

// ================================
// DOM references
// ================================
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
const usersNav = document.getElementById('usersNav');
const rolesNav = document.getElementById('rolesNav');
const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
const vehicleTableBody = document.getElementById('vehicleTableBody');
const vehicleApiNotice = document.getElementById('vehicleApiNotice');
const loadVehiclesBtn = document.getElementById('loadVehiclesBtn');
const vehicleSearchInput = document.getElementById('vehicleSearchInput');
const usersPage = document.getElementById('usersPage');
const userTableBody = document.getElementById('userTableBody');
const userApiNotice = document.getElementById('userApiNotice');
const userSearchInput = document.getElementById('userSearchInput');
const userProfileModalEl = document.getElementById('userProfileModal');
const userProfileBody = document.getElementById('userProfileBody');
const userProfileModal = userProfileModalEl && window.bootstrap ? new bootstrap.Modal(userProfileModalEl) : null;
const rolesPage = document.getElementById('rolesPage');
const roleTableBody = document.getElementById('roleTableBody');
const roleApiNotice = document.getElementById('roleApiNotice');
const addRoleBtn = document.getElementById('addRoleBtn');
const roleCreateForm = document.getElementById('roleCreateForm');
const roleNameInput = document.getElementById('roleNameInput');
const saveRoleBtn = document.getElementById('saveRoleBtn');
const cancelRoleBtn = document.getElementById('cancelRoleBtn');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

let allVehicles = [];
let allUsers = [];
let allProfiles = [];
let allRoles = [];
let roleLookupById = new Map();

// ================================
// Reusable utility helpers
// ================================
function getStoredToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

function setStoredToken(token) {
  localStorage.setItem(AUTH_STORAGE_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getTokenFromResponse(responseBody) {
  return responseBody?.token
    || responseBody?.accessToken
    || responseBody?.jwt
    || responseBody?.data?.token
    || responseBody?.data?.accessToken
    || null;
}

// Handles multiple API response shapes so table rows still render.
function extractCollection(responseBody, preferredKeys = []) {
  if (Array.isArray(responseBody)) {
    return responseBody;
  }

  for (const key of preferredKeys) {
    const value = responseBody?.[key] || responseBody?.data?.[key] || responseBody?.result?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  const candidates = [
    responseBody?.data,
    responseBody?.result,
    responseBody?.items,
    responseBody?.records,
    responseBody?.rows,
    responseBody?.users,
    responseBody?.vehicles,
    responseBody?.roles
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function getAuthHeaders(includeJson = false) {
  const token = getStoredToken();

  if (!token) {
    throw new Error('Missing auth token. Please log in again.');
  }

  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`
  };
}

// ================================
// Dashboard widgets
// ================================
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

// ================================
// Vehicles
// ================================
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

function formatDriverAddress(rawAddress) {
  if (!rawAddress) {
    return 'N/A';
  }

  if (typeof rawAddress === 'string') {
    return rawAddress;
  }

  const orderedParts = [
    rawAddress.street,
    rawAddress.road,
    rawAddress.township,
    rawAddress.city
  ].filter(Boolean);

  return orderedParts.length ? orderedParts.join(', ') : 'N/A';
}

function mapVehicle(rawVehicle) {
  return {
    id: rawVehicle.id || rawVehicle.vehicleId || rawVehicle.userId || null,
    plateNumber: rawVehicle.plateNumber || rawVehicle.vehiclePlateNumber || rawVehicle.plateNo || 'N/A',
    driverId: rawVehicle.driverId || rawVehicle.userId || rawVehicle.driver?.id || rawVehicle.user?.id || 'N/A',
    contact: rawVehicle.contact || rawVehicle.phone || rawVehicle.mobile || rawVehicle.driver?.contact || rawVehicle.user?.phone || 'N/A',
    status: rawVehicle.status || rawVehicle.vehicleStatus || rawVehicle.driverStatus || 'Unknown',
    address: formatDriverAddress(rawVehicle.address || rawVehicle.currentAddress || rawVehicle.locationAddress || rawVehicle.location)
  };
}

function setVehicleNotice(type, message) {
  vehicleApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  vehicleApiNotice.textContent = message;
}

function renderVehicles(vehicles) {
  if (!vehicles.length) {
    vehicleTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">No vehicles found.</td>
      </tr>
    `;
    return;
  }

  vehicleTableBody.innerHTML = vehicles.map((vehicle, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="fw-semibold">${vehicle.plateNumber}</td>
      <td>${vehicle.driverId}</td>
      <td>${vehicle.contact}</td>
      <td>${vehicle.address}</td>
      <td><span class="badge ${vehicleStatusBadge(vehicle.status)}">${vehicle.status}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-danger js-delete-vehicle" data-id="${vehicle.id ?? ''}" data-plate="${vehicle.plateNumber}">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterVehicleList() {
  const query = vehicleSearchInput.value.trim().toLowerCase();

  const filteredVehicles = allVehicles.filter((vehicle) => (
    vehicle.plateNumber.toLowerCase().includes(query)
      || String(vehicle.driverId).toLowerCase().includes(query)
      || vehicle.contact.toLowerCase().includes(query)
      || vehicle.status.toLowerCase().includes(query)
      || vehicle.address.toLowerCase().includes(query)
  ));

  renderVehicles(filteredVehicles);
}

async function loadVehiclesFromApi() {
  try {
    getAuthHeaders();
  } catch (error) {
    setVehicleNotice('warning', error.message);
    showLogin();
    return;
  }

  setVehicleNotice('info', `Loading vehicles from ${VEHICLE_API_URL} ...`);

  try {
    const response = await fetch(VEHICLE_API_URL, {
      headers: getAuthHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const responseBody = await response.json();
    const list = extractCollection(responseBody, ['vehicles']);
    allVehicles = list.map((vehicle) => mapVehicle(vehicle));

    filterVehicleList();
    setVehicleNotice('success', `Loaded ${allVehicles.length} vehicles from API.`);
  } catch (error) {
    allVehicles = [];
    renderVehicles([]);
    setVehicleNotice('danger', `Failed to load vehicles from API. ${error.message}`);
  }
}

// ================================
// Users & profiles
// ================================
function setUserNotice(type, message) {
  userApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  userApiNotice.textContent = message;
}

function normalizeUserRoles(rawUser) {
  const possibleRoleSources = [
    rawUser.roles,
    rawUser.role,
    rawUser.userRoles,
    rawUser.roleNames,
    rawUser.roleName,
    rawUser.assignedRoles,
    rawUser.authorities
  ];

  const rawRoles = possibleRoleSources.find((value) => value !== undefined && value !== null);

  if (Array.isArray(rawRoles)) {
    return rawRoles.map((role) => {
      if (typeof role === 'string') {
        return role.trim();
      }

      return (
        role?.name
        || role?.roleName
        || role?.title
        || role?.label
        || role?.role
        || String(role?.id || '').trim()
      );
    }).filter(Boolean);
  }

  if (typeof rawRoles === 'string') {
    return rawRoles.split(',').map((item) => item.trim()).filter(Boolean);
  }

  if (typeof rawRoles === 'object') {
    const mappedRole = rawRoles?.name || rawRoles?.roleName || rawRoles?.title || rawRoles?.label || rawRoles?.role;
    return mappedRole ? [String(mappedRole).trim()] : [];
  }

  return [];
}

function extractRoleIds(rawUser) {
  const roleIdSources = [
    rawUser.roleIds,
    rawUser.rolesIds,
    rawUser.roleId,
    rawUser.userRoleIds,
    rawUser.assignedRoleIds,
    rawUser.role
  ];

  const source = roleIdSources.find((value) => value !== undefined && value !== null);

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          return item.id ?? item.roleId ?? item.value ?? null;
        }

        return item;
      })
      .filter((item) => item !== undefined && item !== null && String(item).trim() !== '')
      .map((item) => String(item));
  }

  if (typeof source === 'string' || typeof source === 'number') {
    return String(source)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function resolveAssignedRoles(rawUser) {
  const directRoles = normalizeUserRoles(rawUser);

  if (directRoles.length) {
    return directRoles;
  }

  const roleIds = extractRoleIds(rawUser);

  if (!roleIds.length || !roleLookupById.size) {
    return [];
  }

  const mappedNames = roleIds
    .map((id) => roleLookupById.get(String(id)) || roleLookupById.get(Number(id)))
    .filter(Boolean);

  return [...new Set(mappedNames)];
}

function mapUser(rawUser) {
  const embeddedProfile = rawUser.profile || {};

  return {
    id: rawUser.id ?? rawUser.userId ?? rawUser._id ?? rawUser.uuid ?? null,
    name: rawUser.name || rawUser.fullName || rawUser.username || embeddedProfile.fullName || rawUser.email || 'Unknown',
    email: rawUser.email || embeddedProfile.email || 'N/A',
    roles: resolveAssignedRoles(rawUser),
    raw: rawUser
  };
}

function getDisplayLocation(profile = {}) {
  const directLocation = profile.address || profile.locationName || profile.city || profile.location;

  if (typeof directLocation === 'string' && directLocation.trim()) {
    return directLocation;
  }

  const latitude = profile.latitude ?? profile.location?.latitude;
  const longitude = profile.longitude ?? profile.location?.longitude;

  if (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null) {
    return `${latitude}, ${longitude}`;
  }

  return 'N/A';
}

function renderUsers(users) {
  if (!users.length) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">No users found.</td>
      </tr>
    `;
    return;
  }

  userTableBody.innerHTML = users.map((user, index) => `
    <tr>
      <td class="fw-semibold">${index + 1}</td>
      <td>${user.name}</td>
      <td>${user.roles.length ? user.roles.join(', ') : '<span class="text-muted">No roles assigned</span>'}</td>
      <td>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-gradient-primary btn-sm view-user-profile-btn" data-user-id="${user.id ?? ''}" data-user-name="${user.name}" data-user-email="${user.email}">
            <i class="bi bi-person-vcard me-1"></i>View Profile
          </button>
          <button class="btn btn-soft-secondary btn-sm copy-user-id-btn" data-user-id="${user.id ?? ''}">
            <i class="bi bi-clipboard me-1"></i>Copy ID
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterUsers() {
  const query = userSearchInput.value.trim().toLowerCase();

  if (!query) {
    renderUsers(allUsers);
    return;
  }

  const filteredUsers = allUsers.filter((user) => {
    const roleText = user.roles.join(' ').toLowerCase();

    return user.name.toLowerCase().includes(query)
      || roleText.includes(query)
      || String(user.email || '').toLowerCase().includes(query)
      || String(user.id || '').toLowerCase().includes(query);
  });

  renderUsers(filteredUsers);
}

function renderUserProfile(profile, userName) {
  const safeUser = profile || {};
  const embeddedProfile = safeUser.profile || {};

  const roleList = normalizeUserRoles(safeUser);
  const roleValue = roleList.length ? roleList.join(', ') : 'No roles assigned';

  const fullName = embeddedProfile.fullName || safeUser.fullName || safeUser.name || userName || 'N/A';
  const email = embeddedProfile.email || safeUser.email || 'N/A';
  const phone = embeddedProfile.contact || safeUser.phone || safeUser.contact || safeUser.mobile || 'N/A';
  const dob = embeddedProfile.dob || safeUser.dob || 'N/A';
  const gender = embeddedProfile.gender || safeUser.gender || 'N/A';
  const location = getDisplayLocation(embeddedProfile);
  const profilePic = embeddedProfile.profilePic || 'nopic';
  const status = safeUser.status || safeUser.accountStatus || (safeUser.hasProfile ? 'Profile linked' : 'Profile pending');

  userProfileBody.innerHTML = `
    <div class="user-profile-popup">
      <div class="user-profile-header">
        <div class="user-avatar">${fullName.charAt(0).toUpperCase()}</div>
        <div>
          <h5 class="mb-1">${fullName}</h5>
          <p class="text-muted mb-2">${email}</p>
          <span class="badge text-bg-warning text-dark fw-semibold">${roleValue}</span>
        </div>
      </div>
      <div class="user-profile-grid">
        <div class="profile-item"><span class="label">User ID</span><span class="value">${safeUser.id || 'N/A'}</span></div>
        <div class="profile-item"><span class="label">Phone</span><span class="value">${phone}</span></div>
        <div class="profile-item"><span class="label">Date of Birth</span><span class="value">${dob}</span></div>
        <div class="profile-item"><span class="label">Gender</span><span class="value text-capitalize">${gender}</span></div>
        <div class="profile-item"><span class="label">Location</span><span class="value">${location}</span></div>
        <div class="profile-item"><span class="label">Profile Picture</span><span class="value">${profilePic}</span></div>
      </div>
      <div class="user-profile-footer">
        <span class="text-muted">Account Status</span>
        <span class="badge rounded-pill text-bg-light border">${status}</span>
      </div>
    </div>
  `;

  if (userProfileModal) {
    userProfileModal.show();
  }
}

async function loadUsersFromApi() {
  try {
    getAuthHeaders();
  } catch (error) {
    setUserNotice('warning', error.message);
    showLogin();
    return;
  }

  setUserNotice('info', `Loading users from ${USERS_API_URL} ...`);

  try {
    if (!allRoles.length) {
      await loadRolesFromApi();
    }

    const response = await fetch(USERS_API_URL, {
      headers: getAuthHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const responseBody = await response.json();
    const list = extractCollection(responseBody, ['users']);

    allUsers = list.map(mapUser);
    filterUsers();

    const noRoleCount = allUsers.filter((user) => !user.roles.length).length;
    const roleText = noRoleCount ? ` (${noRoleCount} users without mapped roles)` : '';
    setUserNotice('success', `Loaded ${allUsers.length} users from API${roleText}.`);
  } catch (error) {
    allUsers = [];
    renderUsers([]);
    setUserNotice('danger', `Failed to load users from API. ${error.message}`);
  }
}

async function loadProfilesFromApi() {
  if (allProfiles.length) {
    return allProfiles;
  }

  const response = await fetch(PROFILES_API_URL, {
    headers: getAuthHeaders()
  });

  if (response.status === 403) {
    // Some backends restrict /getProfiles. We gracefully fall back to user table data.
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to load profiles. Status ${response.status}`);
  }

  const responseBody = await response.json();
  const list = extractCollection(responseBody, ['profiles', 'users']);
  allProfiles = list;
  return allProfiles;
}

async function viewUserProfile(userId, userName, userEmail = '') {
  try {
    const profiles = await loadProfilesFromApi();

    const profile = profiles.find((item) => (
      String(item.id ?? item.userId ?? item._id ?? item.uuid ?? '') === String(userId)
    )) || profiles.find((item) => (
      (item.email || '').toLowerCase() === String(userEmail || '').toLowerCase()
    )) || profiles.find((item) => (
      (item.name || item.fullName || '').toLowerCase() === String(userName || '').toLowerCase()
    ));

    if (profile) {
      renderUserProfile(profile, userName);
      return;
    }

    // Fallback when profile endpoint is blocked: reuse user row data.
    const fallbackUser = allUsers.find((user) => String(user.id) === String(userId))
      || allUsers.find((user) => user.name.toLowerCase() === String(userName || '').toLowerCase());

    renderUserProfile({
      id: fallbackUser?.id || userId,
      name: fallbackUser?.name || userName,
      email: fallbackUser?.email || userEmail,
      roles: fallbackUser?.roles || [],
      profile: fallbackUser?.raw?.profile || {},
      hasProfile: fallbackUser?.raw?.hasProfile,
      status: 'Profile details limited by API permission'
    }, userName);

    setUserNotice('warning', 'Full profile endpoint is restricted (403). Showing available user details.');
  } catch (error) {
    setUserNotice('danger', error.message);
  }
}

function copyUserId(userId) {
  if (!userId) {
    setUserNotice('warning', 'This user does not have a visible ID in API response.');
    return;
  }

  navigator.clipboard.writeText(String(userId))
    .then(() => setUserNotice('success', `User ID ${userId} copied to clipboard.`))
    .catch(() => setUserNotice('warning', `Copy failed. User ID: ${userId}`));
}

// ================================
// Roles
// ================================
function setRoleNotice(type, message) {
  roleApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  roleApiNotice.textContent = message;
}

function mapRole(rawRole) {
  return {
    id: rawRole.id ?? rawRole.roleId ?? 'N/A',
    name: rawRole.name || rawRole.roleName || 'Unknown'
  };
}

function renderRoles(roles) {
  if (!roles.length) {
    roleTableBody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center text-muted py-4">No roles found.</td>
      </tr>
    `;
    return;
  }

  roleTableBody.innerHTML = roles.map((role) => `
    <tr>
      <td class="fw-semibold">${role.id}</td>
      <td>${role.name}</td>
    </tr>
  `).join('');
}

function setRoleFormVisible(isVisible) {
  roleCreateForm.classList.toggle('d-none', !isVisible);

  if (!isVisible) {
    roleCreateForm.reset();
  }
}

function setRoleCreateLoadingState(isLoading) {
  saveRoleBtn.disabled = isLoading;
  cancelRoleBtn.disabled = isLoading;
  roleNameInput.disabled = isLoading;
  saveRoleBtn.textContent = isLoading ? 'Creating...' : 'Create Role';
}

async function loadRolesFromApi() {
  try {
    getAuthHeaders();
  } catch (error) {
    setRoleNotice('warning', error.message);
    showLogin();
    return;
  }

  setRoleNotice('info', `Loading roles from ${ROLES_API_URL} ...`);

  try {
    const response = await fetch(ROLES_API_URL, {
      headers: getAuthHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const responseBody = await response.json();
    const list = extractCollection(responseBody, ['roles']);
    allRoles = list.map(mapRole);
    roleLookupById = new Map(allRoles.map((role) => [String(role.id), role.name]));
    renderRoles(allRoles);
    setRoleNotice('success', `Loaded ${allRoles.length} roles from API.`);
  } catch (error) {
    allRoles = [];
    roleLookupById = new Map();
    renderRoles([]);
    setRoleNotice('danger', `Failed to load roles from API. ${error.message}`);
  }
}

async function createRole(roleName) {
  if (!roleName) {
    throw new Error('Role name is required.');
  }

  const response = await fetch(CREATE_ROLE_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ roleName })
  });

  let responseBody = {};

  try {
    responseBody = await response.json();
  } catch {
    responseBody = {};
  }

  if (!response.ok) {
    throw new Error(responseBody?.message || `Failed to create role. Status ${response.status}`);
  }

  return responseBody;
}

// ================================
// Page-level navigation & actions
// ================================
function showDashboardPage() {
  dashboardPage.classList.remove('d-none');
  vehiclesPage.classList.add('d-none');
  usersPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  dashboardNav.classList.add('active');
  vehiclesNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  pageTitle.textContent = 'O_way Admin Overview';
  pageDescription.textContent = 'Manage your yellow 3-wheeler ride network in one place.';
  refreshBtn.classList.remove('d-none');
  window.location.hash = 'dashboard';
}

function showVehiclesPage() {
  dashboardPage.classList.add('d-none');
  vehiclesPage.classList.remove('d-none');
  usersPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  dashboardNav.classList.remove('active');
  vehiclesNav.classList.add('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  pageTitle.textContent = 'Vehicles';
  pageDescription.textContent = 'Search and monitor live vehicle records from the admin API.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'vehicles';

  if (!allVehicles.length) {
    loadVehiclesFromApi();
  }
}

function showUsersPage() {
  dashboardPage.classList.add('d-none');
  vehiclesPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  usersPage.classList.remove('d-none');
  dashboardNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
  usersNav.classList.add('active');
  rolesNav.classList.remove('active');
  pageTitle.textContent = 'Users';
  pageDescription.textContent = 'Search users by name or role and open profiles.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'users';

  if (!allUsers.length) {
    loadUsersFromApi();
  } else {
    // Re-map existing users once roles are loaded to ensure role names are visible.
    if (!allRoles.length) {
      loadRolesFromApi().finally(() => {
        allUsers = allUsers.map((user) => ({ ...user, roles: resolveAssignedRoles(user.raw || {}) }));
        filterUsers();
      });
      return;
    }

    allUsers = allUsers.map((user) => ({ ...user, roles: resolveAssignedRoles(user.raw || {}) }));
    filterUsers();
  }
}

function showRolesPage() {
  dashboardPage.classList.add('d-none');
  vehiclesPage.classList.add('d-none');
  usersPage.classList.add('d-none');
  rolesPage.classList.remove('d-none');
  dashboardNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.add('active');
  pageTitle.textContent = 'Roles';
  pageDescription.textContent = 'Create and manage admin roles.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'roles';

  renderRoles(allRoles);

  if (!allRoles.length) {
    loadRolesFromApi();
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

// ================================
// Auth flow
// ================================
function showDashboard() {
  loginView.classList.add('d-none');
  dashboardView.classList.remove('d-none');
  renderStats();
  renderTrips();
  renderVehicles([]);
  setVehicleNotice('info', 'Open Vehicles page to load data from API.');

  if (window.location.hash === '#vehicles') {
    showVehiclesPage();
    return;
  }

  if (window.location.hash === '#roles') {
    showRolesPage();
    return;
  }

  if (window.location.hash === '#users') {
    showUsersPage();
    return;
  }

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

async function login(name, password) {
  if (!name || !password) {
    throw new Error('Username and password are required.');
  }

  const response = await fetch(LOGIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, password })
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

  setStoredToken(token);
}

function logout() {
  clearStoredToken();
  showLogin();
  loginForm.reset();
  loginError.classList.add('d-none');
  setLoginLoadingState(false);
  setRoleFormVisible(false);
  if (userProfileModal) {
    userProfileModal.hide();
  }
  userProfileBody.innerHTML = '';
}

// ================================
// Event bindings
// ================================
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.getElementById('name').value.trim();
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

usersNav.addEventListener('click', (event) => {
  event.preventDefault();
  showUsersPage();
});

rolesNav.addEventListener('click', (event) => {
  event.preventDefault();
  showRolesPage();
});

addRoleBtn.addEventListener('click', () => {
  setRoleFormVisible(true);
  roleNameInput.focus();
});

cancelRoleBtn.addEventListener('click', () => {
  setRoleFormVisible(false);
});

roleCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const roleName = roleNameInput.value.trim();
  setRoleCreateLoadingState(true);

  try {
    await createRole(roleName);
    setRoleNotice('success', `Role "${roleName}" created successfully.`);
    setRoleFormVisible(false);
    await loadRolesFromApi();
  } catch (error) {
    setRoleNotice('danger', error.message);
  } finally {
    setRoleCreateLoadingState(false);
  }
});

vehicleSearchInput.addEventListener('input', filterVehicleList);
userSearchInput.addEventListener('input', filterUsers);

userTableBody.addEventListener('click', (event) => {
  const profileButton = event.target.closest('.view-user-profile-btn');

  if (profileButton) {
    const userId = profileButton.dataset.userId || '';
    const userName = profileButton.dataset.userName || 'Selected user';
    const userEmail = profileButton.dataset.userEmail || '';
    viewUserProfile(userId, userName, userEmail);
    return;
  }

  const copyButton = event.target.closest('.copy-user-id-btn');

  if (copyButton) {
    copyUserId(copyButton.dataset.userId || '');
  }
});

refreshBtn.addEventListener('click', refreshDashboard);
logoutBtn.addEventListener('click', logout);
loadVehiclesBtn.addEventListener('click', loadVehiclesFromApi);

vehicleTableBody.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.js-delete-vehicle');

  if (!deleteButton) {
    return;
  }

  handleDeleteVehicle(deleteButton.dataset.id, deleteButton.dataset.plate);
});


// ================================
// App bootstrap
// ================================
if (getStoredToken()) {
  showDashboard();
} else {
  showLogin();
}

window.sendAlert = sendAlert;
window.assignVehicle = assignVehicle;
window.downloadReport = downloadReport;
