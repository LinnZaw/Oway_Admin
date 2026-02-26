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
  { id: 'TR-5021', distanceKm: 4.8, vehicle: 'TW-4821', status: 'In Progress', eta: '08 min' },
  { id: 'TR-5022', distanceKm: 1.7, vehicle: 'TW-3094', status: 'Picking Up', eta: '03 min' },
  { id: 'TR-5023', distanceKm: 9.4, vehicle: 'TW-7740', status: 'Delayed', eta: '14 min' },
  { id: 'TR-5024', distanceKm: 6.1, vehicle: 'TW-6252', status: 'In Progress', eta: '11 min' }
];

// ================================
// API endpoints and auth storage
// ================================
const LOGIN_API_URL = 'http://localhost:8000/api/auth/login';
const ROLES_API_URL = 'http://localhost:8000/api/admin/getRoles';
const CREATE_ROLE_API_URL = 'http://localhost:8000/api/admin/roles';
const USERS_API_URL = 'http://localhost:8000/api/admin/getUser';
const PROFILES_API_URL = 'http://localhost:8000/api/admin/getProfiles';
const VEHICLES_API_URL = 'http://localhost:8000/api/admin/getVehicle';
const TRANSACTIONS_API_URL = 'http://localhost:8000/api/admin/getTransaction';
const UPDATE_VEHICLE_API_URL = 'http://localhost:8000/api/admin';
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
const rentalPage = document.getElementById('rentalPage');
const rentalNav = document.getElementById('rentalNav');
const usersNav = document.getElementById('usersNav');
const rolesNav = document.getElementById('rolesNav');
const vehiclesNav = document.getElementById('vehiclesNav');
const transactionsNav = document.getElementById('transactionsNav');
const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
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
const vehiclesPage = document.getElementById('vehiclesPage');
const vehicleTableBody = document.getElementById('vehicleTableBody');
const vehicleApiNotice = document.getElementById('vehicleApiNotice');
const transactionsPage = document.getElementById('transactionsPage');
const transactionTableBody = document.getElementById('transactionTableBody');
const transactionApiNotice = document.getElementById('transactionApiNotice');
const transactionSearchInput = document.getElementById('transactionSearchInput');
const transactionStatusFilter = document.getElementById('transactionStatusFilter');
const rentalTableBody = document.getElementById('rentalTableBody');
const rentalApiNotice = document.getElementById('rentalApiNotice');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

let allUsers = [];
let allProfiles = [];
let allRoles = [];
let allVehicles = [];
let allTransactions = [];
let filteredTransactions = [];
let roleLookupById = new Map();
let allRentals = [];
let rentalRelativeTimer = null;

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
// Rental management
// ================================
function setRentalNotice(type, message) {
  rentalApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  rentalApiNotice.textContent = message;
}

function getRentalStatusBadgeClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING':
      return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    case 'APPROVED':
      return 'bg-success-subtle text-success-emphasis border border-success-subtle';
    case 'REJECTED':
      return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
    default:
      return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  }
}

function renderTrips() {
  const body = document.getElementById('tripTableBody');

  if (!body) {
    return;
  }

  body.innerHTML = liveTrips.map((trip) => `
    <tr>
      <td class="fw-semibold">${trip.id}</td>
      <td><span class="rental-distance-cell">${Number(trip.distanceKm || 0).toFixed(1)} km</span></td>
      <td>${trip.vehicle}</td>
      <td><span class="badge status ${statusBadge(trip.status)}">${trip.status}</span></td>
      <td>${trip.eta}</td>
    </tr>
  `).join('');
}

// ================================
// Users & profiles
// ================================

function setVehicleNotice(type, message) {
  vehicleApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  vehicleApiNotice.textContent = message;
}

function mapVehicle(rawVehicle) {
  return {
    id: rawVehicle.id ?? rawVehicle.vehicleId ?? null,
    plateNumber: rawVehicle.plateNumber || 'N/A',
    nrc: rawVehicle.nrc || 'N/A',
    contact: rawVehicle.contact || 'N/A',
    ownerName: rawVehicle.user?.name || 'N/A',
    vehicleStatus: rawVehicle.vehicleStatus || 'UNKNOWN'
  };
}

function getVehicleStatusBadgeClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'ACCEPTED':
      return 'bg-success-subtle text-success-emphasis border border-success-subtle';
    case 'PENDING':
      return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    case 'REJECTED':
      return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
    default:
      return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  }
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

  vehicleTableBody.innerHTML = vehicles.map((vehicle, index) => {
    const normalizedStatus = String(vehicle.vehicleStatus || '').toUpperCase();
    const actionButtons = normalizedStatus === 'PENDING'
      ? `
        <div class="d-flex gap-2">
          <button class="btn btn-success btn-sm accept-vehicle-btn" data-vehicle-id="${vehicle.id}">
            <i class="bi bi-check2-circle me-1"></i>Accept
          </button>
          <button class="btn btn-danger btn-sm deny-vehicle-btn" data-vehicle-id="${vehicle.id}">
            <i class="bi bi-x-circle me-1"></i>Deny
          </button>
        </div>
      `
      : '';

    return `
      <tr>
        <td class="fw-semibold">${index + 1}</td>
        <td class="fw-semibold">${vehicle.plateNumber}</td>
        <td>${vehicle.nrc}</td>
        <td>${vehicle.contact}</td>
        <td>${vehicle.ownerName}</td>
        <td>
          <span class="badge rounded-pill fw-semibold ${getVehicleStatusBadgeClass(vehicle.vehicleStatus)}">
            ${vehicle.vehicleStatus}
          </span>
        </td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');
}

async function patchVehicleStatus(vehicleId, action) {
  const normalizedAction = String(action || '').toLowerCase();

  if (!['accept', 'deny'].includes(normalizedAction)) {
    throw new Error('Invalid vehicle action.');
  }

  const normalizedVehicleId = String(vehicleId || '').trim();

  if (!normalizedVehicleId) {
    throw new Error('Vehicle ID is missing.');
  }

  const requestUrl = `${UPDATE_VEHICLE_API_URL}/updateVehicle/${encodeURIComponent(normalizedVehicleId)}`;
  const requestBody = JSON.stringify({
    status: normalizedAction === 'accept' ? 'ACCEPTED' : 'REJECTED'
  });

  let apiResponse;

  try {
    apiResponse = await fetch(requestUrl, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: requestBody
    });
  } catch {
    throw new Error(`Unable to reach vehicle update API at ${requestUrl}. Check backend server/CORS settings.`);
  }

  let responseBody = {};

  try {
    responseBody = await apiResponse.json();
  } catch {
    throw new Error(`Unable to reach vehicle update API at ${patchUrl}. Check backend server/CORS settings.`);
  }

  if (apiResponse.status === 401 || apiResponse.status === 403) {
    throw new Error('Session expired. Please log in again.');
  }

  if (!apiResponse.ok) {
    throw new Error(responseBody?.message || `Failed to ${normalizedAction} vehicle. Status ${apiResponse.status}`);
  }

  throw new Error(lastError || `Failed to ${normalizedAction} vehicle.`);
}

async function loadVehiclesFromApi() {
  try {
    getAuthHeaders();
  } catch (error) {
    setVehicleNotice('warning', error.message);
    showLogin();
    return;
  }

  setVehicleNotice('info', `Loading vehicles from ${VEHICLES_API_URL} ...`);

  try {
    const response = await fetch(VEHICLES_API_URL, {
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

    allVehicles = list.map(mapVehicle);
    renderVehicles(allVehicles);
    setVehicleNotice('success', `Loaded ${allVehicles.length} vehicles from API.`);
  } catch (error) {
    allVehicles = [];
    renderVehicles([]);
    setVehicleNotice('danger', `Failed to load vehicles from API. ${error.message}`);
  }
}

function setUserNotice(type, message) {
  userApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  userApiNotice.textContent = message;
}

// ================================
// Transactions
// ================================
function setTransactionNotice(type, message) {
  transactionApiNotice.className = `alert alert-${type} py-2 px-3 small mb-3`;
  transactionApiNotice.textContent = message;
}

function formatTransactionId(transactionId) {
  const numericId = Number(transactionId);

  if (!Number.isFinite(numericId)) {
    return 'N/A';
  }

  return `TID-${String(Math.trunc(numericId)).padStart(3, '0')}`;
}

function formatAmount(amount) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : '0.00';
}

function formatReferenceId(referenceId) {
  const rawReference = String(referenceId || '').trim();

  if (!rawReference) {
    return 'N/A';
  }

  if (/^RefID-\d{3,}$/i.test(rawReference)) {
    return rawReference;
  }

  if (/^\d+$/.test(rawReference)) {
    return `RefID-${rawReference.padStart(3, '0')}`;
  }

  return rawReference;
}

function formatTransactionDate(createdAt) {
  if (!createdAt) {
    return 'N/A';
  }

  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A';
  }

  return parsedDate.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTransactionTypeBadgeClass(type) {
  switch (String(type || '').toUpperCase()) {
    case 'DEPOSIT':
      return 'bg-success-subtle text-success-emphasis border border-success-subtle';
    case 'TOPUP':
      return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    case 'TRANSFER':
      return 'bg-primary-subtle text-primary-emphasis border border-primary-subtle';
    default:
      return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
  }
}

function getTransactionStatusBadgeClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return 'bg-success-subtle text-success-emphasis border border-success-subtle';
    case 'PENDING':
      return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    case 'FAILED':
      return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle';
    case 'CANCELLED':
      return 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
    case 'REVERSED':
      return 'bg-primary-subtle text-primary-emphasis border border-primary-subtle';
    default:
      return 'bg-light text-dark border';
  }
}

function mapTransaction(rawTransaction) {
  return {
    id: rawTransaction.id ?? rawTransaction.transactionId ?? null,
    amount: rawTransaction.amount ?? 0,
    type: (rawTransaction.type || 'N/A').toUpperCase(),
    referenceId: rawTransaction.referenceId ?? rawTransaction.refId ?? '',
    createdAt: rawTransaction.createdAt ?? rawTransaction.createdDate ?? rawTransaction.date,
    transactionStatus: (rawTransaction.transactionStatus || rawTransaction.status || 'N/A').toUpperCase(),
    raw: rawTransaction
  };
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    transactionTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No transactions found.</td>
      </tr>
    `;
    return;
  }

  transactionTableBody.innerHTML = transactions.map((transaction) => `
    <tr>
      <td class="fw-semibold">${formatTransactionId(transaction.id)}</td>
      <td>${formatAmount(transaction.amount)}</td>
      <td>
        <span class="badge rounded-pill fw-semibold ${getTransactionTypeBadgeClass(transaction.type)}">
          ${transaction.type}
        </span>
      </td>
      <td>${formatReferenceId(transaction.referenceId)}</td>
      <td>${formatTransactionDate(transaction.createdAt)}</td>
      <td>
        <span class="badge rounded-pill fw-semibold ${getTransactionStatusBadgeClass(transaction.transactionStatus)}">
          ${transaction.transactionStatus}
        </span>
      </td>
    </tr>
  `).join('');
}

function filterTransactions() {
  const query = transactionSearchInput.value.trim().toLowerCase();
  const selectedStatus = transactionStatusFilter.value;

  filteredTransactions = allTransactions.filter((transaction) => {
    const transactionId = formatTransactionId(transaction.id).toLowerCase();
    const type = String(transaction.type || '').toLowerCase();
    const matchesSearch = !query || transactionId.includes(query) || type.includes(query);
    const matchesStatus = selectedStatus === 'ALL' || transaction.transactionStatus === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  renderTransactions(filteredTransactions);
}

async function loadTransactionsFromApi() {
  let headers;

  try {
    headers = getAuthHeaders();
  } catch (error) {
    setTransactionNotice('warning', error.message);
    return;
  }

  setTransactionNotice('info', `Loading transactions from ${TRANSACTIONS_API_URL} ...`);

  try {
    const response = await fetch(TRANSACTIONS_API_URL, {
      method: 'GET',
      headers
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Unable to load transactions.`);
    }

    const responseBody = await response.json();
    const list = extractCollection(responseBody, ['transactions']);

    allTransactions = list.map(mapTransaction);
    filterTransactions();
    setTransactionNotice('success', `Loaded ${allTransactions.length} transactions from API.`);
  } catch (error) {
    allTransactions = [];
    filteredTransactions = [];
    renderTransactions([]);
    setTransactionNotice('danger', `Failed to load transactions from API. ${error.message}`);
  }
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

function formatUserId(userId) {
  const numericId = Number(userId);

  if (!Number.isFinite(numericId)) {
    return 'N/A';
  }

  return `UID-${String(Math.trunc(numericId)).padStart(3, '0')}`;
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
        <td colspan="5" class="text-center text-muted py-4">No users found.</td>
      </tr>
    `;
    return;
  }

  userTableBody.innerHTML = users.map((user, index) => `
    <tr>
      <td class="fw-semibold">${index + 1}</td>
      <td>${user.name}</td>
      <td class="fw-semibold">${formatUserId(user.id)}</td>
      <td>${user.roles.length ? user.roles.join(', ') : '<span class="text-muted">No roles assigned</span>'}</td>
      <td>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-gradient-primary btn-sm view-user-profile-btn" data-user-id="${user.id ?? ''}" data-user-name="${user.name}" data-user-email="${user.email}">
            <i class="bi bi-person-vcard me-1"></i>View Profile
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

function formatRoleId(roleId) {
  const numericId = Number(roleId);

  if (!Number.isFinite(numericId)) {
    return 'N/A';
  }

  return `RID-${String(Math.trunc(numericId)).padStart(3, '0')}`;
}

function renderRoles(roles) {
  if (!roles.length) {
    roleTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted py-4">No roles found.</td>
      </tr>
    `;
    return;
  }

  roleTableBody.innerHTML = roles.map((role, index) => `
    <tr>
      <td class="fw-semibold">${index + 1}</td>
      <td class="fw-semibold">${formatRoleId(role.id)}</td>
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

async function createRole(name) {
  if (!name) {
    throw new Error('Role name is required.');
  }

  const response = await fetch(CREATE_ROLE_API_URL, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ name })
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
function showRentalPage() {
  rentalPage.classList.remove('d-none');
  usersPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  vehiclesPage.classList.add('d-none');
  transactionsPage.classList.add('d-none');
  rentalNav.classList.add('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
  transactionsNav.classList.remove('active');
  pageTitle.textContent = 'Rental Management';
  pageDescription.textContent = 'Track all rental requests and statuses in real time.';
  refreshBtn.classList.remove('d-none');
  window.location.hash = 'rentals';

  if (!allRentals.length) {
    loadRentalsFromApi();
  } else {
    renderRentals(allRentals);
    refreshRentalRelativeTimes();
    startRentalRelativeTimeRefresh();
  }
}

function showUsersPage() {
  rentalPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  vehiclesPage.classList.add('d-none');
  transactionsPage.classList.add('d-none');
  usersPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.add('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
  transactionsNav.classList.remove('active');
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
  rentalPage.classList.add('d-none');
  usersPage.classList.add('d-none');
  vehiclesPage.classList.add('d-none');
  transactionsPage.classList.add('d-none');
  rolesPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.add('active');
  vehiclesNav.classList.remove('active');
  transactionsNav.classList.remove('active');
  pageTitle.textContent = 'Roles';
  pageDescription.textContent = 'Create and manage admin roles.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'roles';

  renderRoles(allRoles);

  if (!allRoles.length) {
    loadRolesFromApi();
  }
}

function showVehiclesPage() {
  rentalPage.classList.add('d-none');
  usersPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  transactionsPage.classList.add('d-none');
  vehiclesPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.add('active');
  transactionsNav.classList.remove('active');
  pageTitle.textContent = 'Vehicles';
  pageDescription.textContent = 'View and manage all registered vehicles.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'vehicles';

  loadVehiclesFromApi();
}

function refreshRentals() {
  loadRentalsFromApi();
}

function showTransactionsPage() {
  rentalPage.classList.add('d-none');
  usersPage.classList.add('d-none');
  rolesPage.classList.add('d-none');
  vehiclesPage.classList.add('d-none');
  transactionsPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
  transactionsNav.classList.add('active');
  pageTitle.textContent = 'Transaction Management';
  pageDescription.textContent = 'Review deposits, topups, and transfers in one place.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'transactions';

  if (!allTransactions.length) {
    loadTransactionsFromApi();
    return;
  }

  filterTransactions();
}

// ================================
// Auth flow
// ================================
function showApp() {
  loginView.classList.add('d-none');
  dashboardView.classList.remove('d-none');
  if (window.location.hash === '#roles') {
    showRolesPage();
    return;
  }

  if (window.location.hash === '#users') {
    showUsersPage();
    return;
  }

  if (window.location.hash === '#vehicles') {
    showVehiclesPage();
    return;
  }

  if (window.location.hash === '#transactions') {
    showTransactionsPage();
    return;
  }

  if (window.location.hash === '#rentals') {
    showRentalPage();
    return;
  }

  showRentalPage();
}

function showLogin() {
  dashboardView.classList.add('d-none');
  loginView.classList.remove('d-none');

  if (rentalRelativeTimer) {
    clearInterval(rentalRelativeTimer);
    rentalRelativeTimer = null;
  }
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
    showApp();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove('d-none');
  } finally {
    setLoginLoadingState(false);
  }
});

rentalNav.addEventListener('click', (event) => {
  event.preventDefault();
  showRentalPage();
});

usersNav.addEventListener('click', (event) => {
  event.preventDefault();
  showUsersPage();
});

rolesNav.addEventListener('click', (event) => {
  event.preventDefault();
  showRolesPage();
});

vehiclesNav.addEventListener('click', (event) => {
  event.preventDefault();
  showVehiclesPage();
});

transactionsNav.addEventListener('click', (event) => {
  event.preventDefault();
  showTransactionsPage();
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

});

transactionSearchInput.addEventListener('input', filterTransactions);
transactionStatusFilter.addEventListener('change', filterTransactions);

vehicleTableBody.addEventListener('click', async (event) => {
  const acceptButton = event.target.closest('.accept-vehicle-btn');
  const denyButton = event.target.closest('.deny-vehicle-btn');

  if (!acceptButton && !denyButton) {
    return;
  }

  const clickedButton = acceptButton || denyButton;
  const vehicleId = clickedButton.dataset.vehicleId;

  if (!vehicleId) {
    setVehicleNotice('danger', 'Vehicle ID is missing.');
    return;
  }

  const action = acceptButton ? 'accept' : 'deny';
  const actionLabel = action === 'accept' ? 'accepted' : 'denied';

  clickedButton.disabled = true;

  try {
    await patchVehicleStatus(vehicleId, action);
    setVehicleNotice('success', `Vehicle ${actionLabel} successfully.`);
    await loadVehiclesFromApi();
  } catch (error) {
    setVehicleNotice('danger', error.message);
  } finally {
    clickedButton.disabled = false;
  }
});

refreshBtn.addEventListener('click', refreshRentals);
logoutBtn.addEventListener('click', logout);


// ================================
// App bootstrap
// ================================
if (getStoredToken()) {
  showApp();
} else {
  showLogin();
}

