// ================================
// API endpoints and auth storage
// ================================
const LOGIN_API_URL = 'http://localhost:8000/api/auth/login';
const ROLES_API_URL = 'http://localhost:8000/api/admin/getRoles';
const CREATE_ROLE_API_URL = 'http://localhost:8000/api/admin/roles';
const USERS_API_URL = 'http://localhost:8000/api/admin/getUser';
const PROFILES_API_URL = 'http://localhost:8000/api/admin/getProfiles';
const VEHICLES_API_URL = 'http://localhost:8000/api/admin/getVehicle';
const UPDATE_VEHICLE_API_URL = 'http://localhost:8000/api/admin';
const RENTALS_API_URL = 'http://localhost:8000/api/admin/getRentals';
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
const rentalTableBody = document.getElementById('rentalTableBody');
const rentalApiNotice = document.getElementById('rentalApiNotice');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

let allUsers = [];
let allProfiles = [];
let allRoles = [];
let allVehicles = [];
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

function formatRelativeTime(isoTime) {
  if (!isoTime) return 'N/A';
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1]
  ];

  for (const [unit, size] of units) {
    if (absSeconds >= size || unit === 'second') {
      return rtf.format(-Math.round(diffSeconds / size), unit);
    }
  }

  return 'just now';
}

function normalizeRental(rawRental) {
  const rental = rawRental?.data && !Array.isArray(rawRental.data) && rawRental.id === undefined
    ? rawRental.data
    : rawRental;
  return {
    id: rental?.id ?? 'N/A',
    vehicleId: rental?.vehicleId ?? null,
    userId: rental?.userId ?? null,
    rentalStatus: String(rental?.rentalStatus || 'UNKNOWN').toUpperCase(),
    rentalTime: rental?.rentalTime || null
  };
}

function extractRentals(responseBody) {
  if (Array.isArray(responseBody)) return responseBody;

  const candidates = [
    responseBody?.data,
    responseBody?.result,
    responseBody?.items,
    responseBody?.records
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object' && (candidate.id !== undefined || candidate.rentalStatus !== undefined)) {
      return [candidate];
    }
  }

  if (responseBody && typeof responseBody === 'object' && (responseBody.id !== undefined || responseBody.rentalStatus !== undefined)) {
    return [responseBody];
  }

  return [];
}

function resolveRentalPresentation(rental) {
  const matchingVehicle = allVehicles.find((vehicle) => String(vehicle.id) === String(rental.vehicleId));
  const matchingUser = allUsers.find((user) => String(user.id) === String(rental.userId));

  return {
    driver: matchingVehicle?.ownerName || `Driver #${rental.vehicleId ?? 'N/A'}`,
    vehicleNo: matchingVehicle?.plateNumber || `Vehicle #${rental.vehicleId ?? 'N/A'}`,
    customer: matchingUser?.name || `Customer #${rental.userId ?? 'N/A'}`
  };
}

function renderRentals(rentals) {
  if (!rentals.length) {
    rentalTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No rentals found.</td></tr>';
    return;
  }

  rentalTableBody.innerHTML = rentals.map((rental) => {
    const info = resolveRentalPresentation(rental);
    return `
      <tr>
        <td class="fw-semibold">${rental.id}</td>
        <td>${info.driver}</td>
        <td>${info.vehicleNo}</td>
        <td>${info.customer}</td>
        <td><span class="badge rounded-pill fw-semibold ${getRentalStatusBadgeClass(rental.rentalStatus)}">${rental.rentalStatus}</span></td>
        <td data-rental-time="${rental.rentalTime || ''}" class="rental-time-cell">${formatRelativeTime(rental.rentalTime)}</td>
      </tr>
    `;
  }).join('');
}

function refreshRentalRelativeTimes() {
  const timeCells = rentalTableBody.querySelectorAll('.rental-time-cell');
  timeCells.forEach((cell) => {
    cell.textContent = formatRelativeTime(cell.dataset.rentalTime);
  });
}

function startRentalRelativeTimeRefresh() {
  if (rentalRelativeTimer) clearInterval(rentalRelativeTimer);
  rentalRelativeTimer = setInterval(refreshRentalRelativeTimes, 30000);
}

async function loadRentalsFromApi() {
  try {
    getAuthHeaders();
  } catch (error) {
    setRentalNotice('warning', error.message);
    showLogin();
    return;
  }

  setRentalNotice('info', `Loading rentals from ${RENTALS_API_URL} ...`);

  try {
    const [usersResult, vehiclesResult] = await Promise.allSettled([
      fetch(USERS_API_URL, { headers: getAuthHeaders() }),
      fetch(VEHICLES_API_URL, { headers: getAuthHeaders() })
    ]);

    if (usersResult.status === 'fulfilled' && usersResult.value.ok) {
      const userBody = await usersResult.value.json();
      allUsers = extractCollection(userBody, ['users']).map(mapUser);
    }

    if (vehiclesResult.status === 'fulfilled' && vehiclesResult.value.ok) {
      const vehicleBody = await vehiclesResult.value.json();
      allVehicles = extractCollection(vehicleBody, ['vehicles']).map(mapVehicle);
    }

    const response = await fetch(RENTALS_API_URL, { headers: getAuthHeaders() });

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(`API failed with status ${response.status}`);
    }

    const responseBody = await response.json();
    allRentals = extractRentals(responseBody).map(normalizeRental);
    renderRentals(allRentals);
    startRentalRelativeTimeRefresh();
    setRentalNotice('success', `Loaded ${allRentals.length} rental record(s) from API.`);
  } catch (error) {
    allRentals = [];
    renderRentals([]);
    setRentalNotice('danger', `Failed to load rentals from API. ${error.message}`);
  }
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

  // Backend expects path variable id and DTO body.
  const payload = {
    vehicleStatus: normalizedAction === 'accept' ? 'ACCEPTED' : 'DECLINED'
  };

  const response = await fetch(`${UPDATE_VEHICLE_API_URL}/updateVehicle/${Number(vehicleId)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload)
  });

  const candidateEndpoints = [
    UPDATE_VEHICLE_API_URL,
    `${VEHICLES_API_URL}/update`,
    `${VEHICLES_API_URL}/status`
  ];

  let lastError = null;

  for (const endpoint of candidateEndpoints) {
    const response = await fetch(`${UPDATE_VEHICLE_API_URL}/updateVehicle/${Number(vehicleId)}`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload)
    });

    let responseBody = {};

    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.');
    }

    if (response.ok) {
      return;
    }

    if (response.status !== 404) {
      throw new Error(responseBody?.message || `Failed to ${normalizedAction} vehicle. Status ${response.status}`);
    }

    lastError = responseBody?.message || `Endpoint not found: ${endpoint}`;
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
  rentalNav.classList.add('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
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
  usersPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.add('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.remove('active');
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
  rolesPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.add('active');
  vehiclesNav.classList.remove('active');
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
  vehiclesPage.classList.remove('d-none');
  rentalNav.classList.remove('active');
  usersNav.classList.remove('active');
  rolesNav.classList.remove('active');
  vehiclesNav.classList.add('active');
  pageTitle.textContent = 'Vehicles';
  pageDescription.textContent = 'View and manage all registered vehicles.';
  refreshBtn.classList.add('d-none');
  window.location.hash = 'vehicles';

  loadVehiclesFromApi();
}

function refreshRentals() {
  loadRentalsFromApi();
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

  const copyButton = event.target.closest('.copy-user-id-btn');

  if (copyButton) {
    copyUserId(copyButton.dataset.userId || '');
  }
});

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

