// Dashboard state
let authToken = null;
let currentPage = 1;
const pageSize = 50;
let trendsChart = null;
let tierChart = null;
let pathsChart = null;
let ipsChart = null;
let userAgentsChart = null;
let referersChart = null;

// Authentication
function login() {
  const password = document.getElementById('passwordInput').value;
  authToken = password;

  fetch('/admin/api/stats', {
    headers: { Authorization: 'Bearer ' + authToken },
  })
    .then((res) => {
      if (res.ok) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadDashboard();
      } else {
        document.getElementById('loginError').textContent = 'Invalid password';
        document.getElementById('loginError').style.display = 'block';
      }
    })
    .catch((err) => {
      document.getElementById('loginError').textContent = 'Error connecting to server';
      document.getElementById('loginError').style.display = 'block';
    });
}

function logout() {
  authToken = null;
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('passwordInput').value = '';
}

// Event listeners
document.getElementById('passwordInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') login();
});

// API helper
async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + authToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error('API request failed');
  return res.json();
}

// Dashboard loading
async function loadDashboard() {
  loadStats();
  loadKeys();
  loadLogs();
  loadCharts();
}

async function loadStats() {
  try {
    const data = await fetchAPI('/admin/api/stats');
    document.getElementById('totalKeys').textContent = data.totalKeys.toLocaleString();
    document.getElementById('activeKeys').textContent = data.activeKeys.toLocaleString();
    document.getElementById('totalRequests').textContent = data.totalRequests.toLocaleString();
    document.getElementById('requests24h').textContent = data.requests24h.toLocaleString();
    document.getElementById('blockedRequests').textContent = data.blockedRequests.toLocaleString();
    document.getElementById('blockRate').textContent = data.blockRate.toFixed(1);
    document.getElementById('mostActiveKey').textContent = data.mostActiveKey || 'N/A';
    document.getElementById('mostActiveCount').textContent =
      data.mostActiveCount?.toLocaleString() || '0';
  } catch (err) {
    showError('Failed to load statistics');
  }
}

// API Keys
async function loadKeys() {
  const tier = document.getElementById('tierFilter').value;
  const active = document.getElementById('activeFilter').value;
  const search = document.getElementById('searchKeys').value;

  let url = '/admin/api/keys?';
  if (tier) url += 'tier=' + tier + '&';
  if (active) url += 'active=' + active + '&';
  if (search) url += 'search=' + encodeURIComponent(search);

  try {
    const data = await fetchAPI(url);
    renderKeysTable(data);
  } catch (err) {
    document.getElementById('keysTable').innerHTML =
      '<div class="error">Failed to load API keys</div>';
  }
}

function renderKeysTable(keys) {
  if (keys.length === 0) {
    document.getElementById('keysTable').innerHTML =
      '<p style="text-align: center; color: #8899a6; padding: 20px;">No API keys found</p>';
    return;
  }

  let html = '<table><thead><tr>';
  html += '<th>API Key</th>';
  html += '<th>Requests</th>';
  html += '<th>Rate Limit</th>';
  html += '<th>Last Used</th>';
  html += '<th>Status</th>';
  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  keys.forEach((key) => {
    html += '<tr>';

    // Combined API Key info cell with name, tier, email, and MC info
    html += '<td class="key-info-cell">';
    html += '<div class="key-info-main">';

    // Show MC avatar if available
    if (key.minecraftUuid) {
      html +=
        '<img src="https://api.mineatar.io/face/' +
        escapeHtml(key.minecraftUuid) +
        '" class="mc-avatar" alt="MC Avatar" />';
    }

    html += '<div class="key-info-text">';
    html +=
      '<div class="key-name">' +
      escapeHtml(key.name) +
      ' <span class="tier-badge tier-' +
      key.tier +
      '">' +
      key.tier +
      '</span></div>';

    // Show MC name if available
    if (key.minecraftName) {
      html += '<div class="key-mc-name">🎮 ' + escapeHtml(key.minecraftName) + '</div>';
    }

    // Show email if available
    if (key.email) {
      html += '<div class="key-email">✉️ ' + escapeHtml(key.email) + '</div>';
    }

    html += '</div></div></td>';

    html += '<td>' + key.requestCount.toLocaleString() + '</td>';
    html += '<td>' + key.rateLimit + '/hour</td>';
    html += '<td class="timestamp">' + formatDate(key.lastUsedAt) + '</td>';
    html +=
      '<td><span class="badge ' +
      (key.isActive ? 'active' : 'inactive') +
      '">' +
      (key.isActive ? 'Active' : 'Inactive') +
      '</span></td>';
    html += '<td><div class="action-buttons">';
    html += '<button class="secondary" onclick="viewKey(\'' + key.id + '\')">View</button>';
    html +=
      '<button class="' +
      (key.isActive ? 'secondary' : 'success') +
      '" onclick="toggleKeyStatus(\'' +
      key.id +
      "', " +
      !key.isActive +
      ')">' +
      (key.isActive ? 'Disable' : 'Enable') +
      '</button>';
    html +=
      '<button class="danger" onclick="deleteKey(\'' +
      key.id +
      "', '" +
      escapeJs(key.name) +
      '\')">Delete</button>';
    html += '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('keysTable').innerHTML = html;
}

async function viewKey(keyId) {
  console.log('viewKey called with:', keyId);
  try {
    const key = await fetchAPI('/admin/api/keys/' + keyId);
    console.log('key data:', key);
    const logs = await fetchAPI('/admin/api/keys/' + keyId + '/logs?limit=10');
    console.log('logs data:', logs);

    let html = '';

    // Show MC profile header if available
    if (key.minecraftUuid) {
      html += '<div class="key-modal-header">';
      html +=
        '<img src="https://api.mineatar.io/face/' +
        escapeHtml(key.minecraftUuid) +
        '" class="mc-avatar-large" alt="MC Avatar" />';
      html += '<div class="key-modal-header-info">';
      html += '<div class="key-modal-name">' + escapeHtml(key.name) + '</div>';
      if (key.minecraftName) {
        html += '<div class="key-modal-mc">🎮 ' + escapeHtml(key.minecraftName) + '</div>';
      }
      html += '<span class="tier-badge tier-' + key.tier + '">' + key.tier + '</span>';
      html += '</div></div>';
    } else {
      html += '<div class="key-modal-header">';
      html += '<div class="key-modal-header-info">';
      html += '<div class="key-modal-name">' + escapeHtml(key.name) + '</div>';
      html += '<span class="tier-badge tier-' + key.tier + '">' + key.tier + '</span>';
      html += '</div></div>';
    }

    html +=
      '<div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value key-display">' +
      key.id +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">' +
      escapeHtml(key.email || 'N/A') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Rate Limit:</span><span class="detail-value">' +
      key.rateLimit +
      ' requests/hour</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Total Requests:</span><span class="detail-value">' +
      key.requestCount.toLocaleString() +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value"><span class="badge ' +
      (key.isActive ? 'active' : 'inactive') +
      '">' +
      (key.isActive ? 'Active' : 'Inactive') +
      '</span></span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Created:</span><span class="detail-value">' +
      formatDate(key.createdAt) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Last Used:</span><span class="detail-value">' +
      formatDate(key.lastUsedAt) +
      '</span></div>';

    // Edit button
    html += '<div style="margin-top: 20px; text-align: center;">';
    html += '<button onclick="showEditKeyModal(\'' + key.id + '\')">✏️ Edit Key Settings</button>';
    html += '</div>';

    html +=
      '<h3 style="margin-top: 25px; margin-bottom: 15px; color: #1da1f2;">Recent Activity</h3>';

    if (logs.length === 0) {
      html +=
        '<p style="color: #8899a6; text-align: center; padding: 20px;">No recent activity</p>';
    } else {
      html +=
        '<table style="font-size: 13px;"><thead><tr><th>Time</th><th>Path</th><th>Status</th></tr></thead><tbody>';
      logs.forEach((log) => {
        html += '<tr>';
        html += '<td class="timestamp">' + formatDate(log.createdAt) + '</td>';
        html += '<td class="key-display">' + escapeHtml(log.path) + '</td>';
        html +=
          '<td>' +
          (log.wasBlocked ? '<span class="badge inactive">Blocked</span>' : log.responseStatus) +
          '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }

    document.getElementById('keyDetails').innerHTML = html;
    openModal('keyModal');
  } catch (err) {
    showError('Failed to load key details');
  }
}

// Store for editing
let editingKeyId = null;

async function showEditKeyModal(keyId) {
  try {
    const key = await fetchAPI('/admin/api/keys/' + keyId);
    editingKeyId = keyId;

    document.getElementById('editKeyName').value = key.name || '';
    document.getElementById('editKeyEmail').value = key.email || '';
    document.getElementById('editKeyTier').value = key.tier;
    document.getElementById('editKeyRateLimit').value = key.rateLimit;
    document.getElementById('editKeyRequestCount').value = key.requestCount;
    document.getElementById('editKeyResult').innerHTML = '';

    closeModal('keyModal');
    openModal('editKeyModal');
  } catch (err) {
    showError('Failed to load key for editing');
  }
}

async function saveKeyEdits() {
  if (!editingKeyId) return;

  const name = document.getElementById('editKeyName').value.trim();
  const email = document.getElementById('editKeyEmail').value.trim();
  const tier = document.getElementById('editKeyTier').value;
  const rateLimit = parseInt(document.getElementById('editKeyRateLimit').value) || 1000;
  const requestCount = parseInt(document.getElementById('editKeyRequestCount').value) || 0;

  if (!name) {
    document.getElementById('editKeyResult').innerHTML =
      '<div class="error">Name is required</div>';
    return;
  }

  try {
    await fetchAPI('/admin/api/keys/' + editingKeyId, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        email: email || null,
        tier,
        rateLimit,
        requestCount,
      }),
    });

    document.getElementById('editKeyResult').innerHTML =
      '<div class="success-message">Key updated successfully!</div>';
    loadKeys();
    loadStats();

    setTimeout(() => {
      closeModal('editKeyModal');
      editingKeyId = null;
    }, 1000);
  } catch (err) {
    document.getElementById('editKeyResult').innerHTML =
      '<div class="error">Failed to update key</div>';
  }
}

async function toggleKeyStatus(keyId, newStatus) {
  console.log('toggleKeyStatus called with:', keyId, newStatus);
  try {
    await fetchAPI('/admin/api/keys/' + keyId, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: newStatus }),
    });
    console.log('toggleKeyStatus success');
    showSuccess('API key ' + (newStatus ? 'enabled' : 'disabled') + ' successfully');
    loadKeys();
    loadStats();
  } catch (err) {
    console.error('toggleKeyStatus error:', err);
    showError('Failed to update API key status');
  }
}

async function deleteKey(keyId, keyName) {
  if (
    !confirm(
      'Are you sure you want to delete the API key "' +
        keyName +
        '"? This action cannot be undone.',
    )
  ) {
    return;
  }

  try {
    await fetchAPI('/admin/api/keys/' + keyId, {
      method: 'DELETE',
    });
    showSuccess('API key deleted successfully');
    loadKeys();
    loadStats();
  } catch (err) {
    showError('Failed to delete API key');
  }
}

function showCreateKeyModal() {
  document.getElementById('createKeyName').value = '';
  document.getElementById('createKeyEmail').value = '';
  document.getElementById('createKeyTier').value = 'free';
  document.getElementById('createKeyResult').innerHTML = '';
  openModal('createKeyModal');
}

async function createKey() {
  const name = document.getElementById('createKeyName').value.trim();
  const email = document.getElementById('createKeyEmail').value.trim();
  const tier = document.getElementById('createKeyTier').value;

  if (!name) {
    document.getElementById('createKeyResult').innerHTML =
      '<div class="error">Please enter a name</div>';
    return;
  }

  try {
    const result = await fetchAPI('/admin/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name, email: email || undefined, tier }),
    });

    let html = '<div class="success-message">';
    html += '<p style="margin-bottom: 10px;"><strong>API Key Created Successfully!</strong></p>';
    html +=
      '<p style="margin-bottom: 10px;">Key: <span class="key-display">' +
      result.key +
      '</span></p>';
    html +=
      '<p style="color: #fff; font-size: 12px;">⚠️ Save this key now! It won\'t be shown again.</p>';
    html += '</div>';

    document.getElementById('createKeyResult').innerHTML = html;

    loadKeys();
    loadStats();
  } catch (err) {
    document.getElementById('createKeyResult').innerHTML =
      '<div class="error">Failed to create API key</div>';
  }
}

// Request Logs
async function loadLogs() {
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchLogs').value;

  let url = '/admin/api/logs?page=' + currentPage + '&limit=' + pageSize;
  if (status === 'blocked') url += '&blocked=true';
  if (status === 'success') url += '&blocked=false';
  if (search) url += '&search=' + encodeURIComponent(search);

  try {
    const data = await fetchAPI(url);
    renderLogsTable(data.logs);
    renderPagination(data.total);
  } catch (err) {
    document.getElementById('logsTable').innerHTML =
      '<div class="error">Failed to load request logs</div>';
  }
}

function renderLogsTable(logs) {
  if (logs.length === 0) {
    document.getElementById('logsTable').innerHTML =
      '<p style="text-align: center; color: #8899a6; padding: 20px;">No request logs found</p>';
    return;
  }

  let html = '<table><thead><tr>';
  html += '<th>Time</th>';
  html += '<th>Method</th>';
  html += '<th>Path</th>';
  html += '<th>IP Address</th>';
  html += '<th>API Key</th>';
  html += '<th>User Agent</th>';
  html += '<th>Status</th>';
  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  logs.forEach((log) => {
    const blocked = log.wasBlocked;
    html += '<tr' + (blocked ? ' class="blocked-row"' : '') + '>';
    html += '<td class="timestamp">' + formatDate(log.createdAt) + '</td>';
    html +=
      '<td><span class="method-badge method-' +
      log.method.toLowerCase() +
      '">' +
      log.method +
      '</span></td>';
    html +=
      '<td class="key-display path-cell" title="' +
      escapeHtml(log.path) +
      '">' +
      escapeHtml(truncateText(log.path, 35)) +
      '</td>';
    html += '<td class="key-display">' + (log.ipAddress || 'N/A') + '</td>';

    // API Key info cell with tier badge
    html += '<td class="log-key-cell">';
    if (log.apiKeyName || log.tier !== 'anonymous') {
      html += '<div class="log-key-info">';
      if (log.apiKeyMcUuid) {
        html +=
          '<img src="https://api.mineatar.io/face/' +
          escapeHtml(log.apiKeyMcUuid) +
          '" class="mc-avatar-small" alt="" />';
      }
      html += '<div class="log-key-text">';
      if (log.apiKeyName) {
        html += '<div class="log-key-name">' + escapeHtml(log.apiKeyName) + '</div>';
      }
      if (log.apiKeyMcName) {
        html += '<div class="log-key-mc">🎮 ' + escapeHtml(log.apiKeyMcName) + '</div>';
      }
      html += '<span class="tier-badge tier-' + log.tier + '">' + log.tier + '</span>';
      html += '</div></div>';
    } else {
      html += '<span class="tier-badge tier-anonymous">anonymous</span>';
    }
    html += '</td>';

    // User Agent snippet
    html += '<td class="ua-cell" title="' + escapeHtml(log.userAgent || 'Unknown') + '">';
    html +=
      '<span class="ua-snippet">' +
      escapeHtml(truncateText(parseUserAgent(log.userAgent), 25)) +
      '</span>';
    html += '</td>';

    html +=
      '<td>' +
      (blocked
        ? '<span class="status-badge status-blocked">Blocked</span>'
        : '<span class="status-badge status-' +
          getStatusClass(log.responseStatus) +
          '">' +
          log.responseStatus +
          '</span>') +
      '</td>';

    // Actions column
    html += '<td>';
    html +=
      '<button class="secondary small" onclick="viewLogDetails(\'' +
      log.requestId +
      '\')">View</button>';
    html += '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('logsTable').innerHTML = html;
}

// Parse user agent to get a friendly name
function parseUserAgent(ua) {
  if (!ua) return 'Unknown';

  // Common patterns
  if (ua.includes('ComputerCraft')) return 'ComputerCraft';
  if (ua.includes('curl')) return 'curl';
  if (ua.includes('Postman')) return 'Postman';
  if (ua.includes('axios')) return 'axios';
  if (ua.includes('node-fetch')) return 'node-fetch';
  if (ua.includes('Python')) return 'Python';
  if (ua.includes('Go-http-client')) return 'Go';

  // Browser detection
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';

  // Truncate unknown
  return ua.length > 20 ? ua.substring(0, 17) + '...' : ua;
}

// Get status code class for styling
function getStatusClass(status) {
  if (!status) return 'unknown';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return 'unknown';
}

// Truncate text helper
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

// View log details modal
async function viewLogDetails(requestId) {
  try {
    const log = await fetchAPI('/admin/api/logs/' + requestId);

    let html = '<div class="log-details">';

    // Request Info Section
    html += '<div class="detail-section">';
    html += '<h4>📡 Request Information</h4>';
    html += '<div class="detail-grid">';
    html +=
      '<div class="detail-row"><span class="detail-label">Request ID:</span><span class="detail-value key-display">' +
      escapeHtml(log.requestId) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Timestamp:</span><span class="detail-value">' +
      new Date(log.createdAt).toLocaleString() +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Method:</span><span class="detail-value"><span class="method-badge method-' +
      log.method.toLowerCase() +
      '">' +
      log.method +
      '</span></span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Path:</span><span class="detail-value key-display" style="word-break: break-all;">' +
      escapeHtml(log.path) +
      '</span></div>';
    html += '</div></div>';

    // Client Info Section
    html += '<div class="detail-section">';
    html += '<h4>🖥️ Client Information</h4>';
    html += '<div class="detail-grid">';
    html +=
      '<div class="detail-row"><span class="detail-label">IP Address:</span><span class="detail-value key-display">' +
      escapeHtml(log.ipAddress || 'N/A') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">User Agent:</span><span class="detail-value ua-full">' +
      escapeHtml(log.userAgent || 'Unknown') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Referer:</span><span class="detail-value">' +
      escapeHtml(log.referer || 'None') +
      '</span></div>';
    html += '</div></div>';

    // API Key Info Section
    html += '<div class="detail-section">';
    html += '<h4>🔑 API Key Information</h4>';
    html += '<div class="detail-grid">';
    if (log.apiKeyId) {
      html +=
        '<div class="detail-row"><span class="detail-label">Key ID:</span><span class="detail-value key-display">' +
        escapeHtml(log.apiKeyId) +
        '</span></div>';
      html +=
        '<div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">' +
        escapeHtml(log.apiKeyName || 'N/A') +
        '</span></div>';
      if (log.apiKeyEmail) {
        html +=
          '<div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">' +
          escapeHtml(log.apiKeyEmail) +
          '</span></div>';
      }
      if (log.apiKeyMcName) {
        html +=
          '<div class="detail-row"><span class="detail-label">MC Name:</span><span class="detail-value">🎮 ' +
          escapeHtml(log.apiKeyMcName) +
          '</span></div>';
      }
      html +=
        '<div class="detail-row"><span class="detail-label">Tier:</span><span class="detail-value"><span class="tier-badge tier-' +
        (log.apiKeyTier || log.tier) +
        '">' +
        (log.apiKeyTier || log.tier) +
        '</span></span></div>';
      html +=
        '<div class="detail-row"><span class="detail-label">Key Status:</span><span class="detail-value"><span class="badge ' +
        (log.apiKeyIsActive ? 'active' : 'inactive') +
        '">' +
        (log.apiKeyIsActive ? 'Active' : 'Inactive') +
        '</span></span></div>';
    } else {
      html +=
        '<div class="detail-row"><span class="detail-label">Tier:</span><span class="detail-value"><span class="tier-badge tier-anonymous">anonymous</span></span></div>';
      html +=
        '<div class="detail-row"><span class="detail-label">Note:</span><span class="detail-value" style="color: #8899a6;">No API key was used for this request</span></div>';
    }
    html += '</div></div>';

    // Response Info Section
    html += '<div class="detail-section">';
    html += '<h4>📤 Response Information</h4>';
    html += '<div class="detail-grid">';
    html +=
      '<div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">';
    if (log.wasBlocked) {
      html += '<span class="status-badge status-blocked">Blocked</span>';
    } else {
      html +=
        '<span class="status-badge status-' +
        getStatusClass(log.responseStatus) +
        '">' +
        log.responseStatus +
        '</span>';
    }
    html += '</span></div>';
    if (log.wasBlocked && log.blockReason) {
      html +=
        '<div class="detail-row"><span class="detail-label">Block Reason:</span><span class="detail-value" style="color: #e0245e;">' +
        escapeHtml(log.blockReason) +
        '</span></div>';
    }
    if (log.responseTimeMs) {
      html +=
        '<div class="detail-row"><span class="detail-label">Response Time:</span><span class="detail-value">' +
        log.responseTimeMs +
        'ms</span></div>';
    }
    html += '</div></div>';

    // Rate Limit Info Section
    html += '<div class="detail-section">';
    html += '<h4>⏱️ Rate Limit Information</h4>';
    html += '<div class="detail-grid">';
    html +=
      '<div class="detail-row"><span class="detail-label">Request Count:</span><span class="detail-value">' +
      (log.rateLimitCount || 0) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Limit:</span><span class="detail-value">' +
      (log.rateLimitLimit || 'N/A') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Remaining:</span><span class="detail-value">' +
      (log.rateLimitRemaining ?? 'N/A') +
      '</span></div>';
    if (log.rateLimitResetAt) {
      html +=
        '<div class="detail-row"><span class="detail-label">Reset At:</span><span class="detail-value">' +
        new Date(log.rateLimitResetAt).toLocaleString() +
        '</span></div>';
    }
    html += '</div></div>';

    html += '</div>';

    document.getElementById('logDetailsContent').innerHTML = html;
    openModal('logDetailsModal');
  } catch (err) {
    console.error('Error loading log details:', err);
    showError('Failed to load log details');
  }
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    document.getElementById('logsPagination').innerHTML = '';
    return;
  }

  let html = '';
  if (currentPage > 1) {
    html += '<button onclick="changePage(' + (currentPage - 1) + ')">← Previous</button>';
  }

  html +=
    '<span style="color: #8899a6; padding: 0 15px;">Page ' +
    currentPage +
    ' of ' +
    totalPages +
    '</span>';

  if (currentPage < totalPages) {
    html += '<button onclick="changePage(' + (currentPage + 1) + ')">Next →</button>';
  }

  document.getElementById('logsPagination').innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  loadLogs();
}

// Charts
async function loadCharts() {
  try {
    const trends = await fetchAPI('/admin/api/charts/trends');
    const tierData = await fetchAPI('/admin/api/charts/tiers');
    const pathsData = await fetchAPI('/admin/api/charts/paths');

    // Trends Chart
    const trendsCtx = document.getElementById('trendsChart').getContext('2d');
    if (trendsChart) trendsChart.destroy();
    trendsChart = new Chart(trendsCtx, {
      type: 'line',
      data: {
        labels: trends.labels,
        datasets: [
          {
            label: 'Requests',
            data: trends.data,
            borderColor: '#1da1f2',
            backgroundColor: 'rgba(29, 161, 242, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#8899a6' },
            grid: { color: '#38444d' },
          },
          x: {
            ticks: { color: '#8899a6' },
            grid: { color: '#38444d' },
          },
        },
      },
    });

    // Tier Chart
    const tierCtx = document.getElementById('tierChart').getContext('2d');
    if (tierChart) tierChart.destroy();
    tierChart = new Chart(tierCtx, {
      type: 'doughnut',
      data: {
        labels: tierData.labels,
        datasets: [
          {
            data: tierData.data,
            backgroundColor: ['#38444d', '#17bf63', '#1da1f2', '#794bc4'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8899a6' },
          },
        },
      },
    });

    // Paths Chart (Top Endpoints)
    const pathsCtx = document.getElementById('pathsChart').getContext('2d');
    if (pathsChart) pathsChart.destroy();
    pathsChart = new Chart(pathsCtx, {
      type: 'bar',
      data: {
        labels: pathsData.labels,
        datasets: [
          {
            label: 'Requests',
            data: pathsData.data,
            backgroundColor: '#1da1f2',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (context) {
                // Show full path in tooltip
                return pathsData.fullPaths[context[0].dataIndex];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: '#8899a6' },
            grid: { color: '#38444d' },
          },
          y: {
            ticks: { color: '#8899a6', font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });

    // IPs Chart (Requests by IP)
    const ipsData = await fetchAPI('/admin/api/charts/ips');
    const ipsCtx = document.getElementById('ipsChart').getContext('2d');
    if (ipsChart) ipsChart.destroy();
    ipsChart = new Chart(ipsCtx, {
      type: 'bar',
      data: {
        labels: ipsData.labels,
        datasets: [
          {
            label: 'Requests',
            data: ipsData.data,
            backgroundColor: '#17bf63',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const ip = ipsData.labels[index];
            loadIpPathBreakdown(ip);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function () {
                return 'Click for path breakdown';
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: '#8899a6' },
            grid: { color: '#38444d' },
          },
          y: {
            ticks: { color: '#8899a6', font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });

    // User Agents Chart
    const uaData = await fetchAPI('/admin/api/charts/useragents');
    const uaCtx = document.getElementById('userAgentsChart').getContext('2d');
    if (userAgentsChart) userAgentsChart.destroy();
    userAgentsChart = new Chart(uaCtx, {
      type: 'bar',
      data: {
        labels: uaData.labels,
        datasets: [
          {
            label: 'Requests',
            data: uaData.data,
            backgroundColor: '#794bc4',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (context) {
                return uaData.fullUserAgents[context[0].dataIndex];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: '#8899a6' },
            grid: { color: '#38444d' },
          },
          y: {
            ticks: { color: '#8899a6', font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });

    // Referers Chart
    const refData = await fetchAPI('/admin/api/charts/referers');
    const refCtx = document.getElementById('referersChart').getContext('2d');
    if (referersChart) referersChart.destroy();
    referersChart = new Chart(refCtx, {
      type: 'bar',
      data: {
        labels: refData.labels,
        datasets: [
          {
            label: 'Requests',
            data: refData.data,
            backgroundColor: '#f45d22',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (context) {
                return refData.fullReferers[context[0].dataIndex];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: '#8899a6' },
            grid: { color: '#38444d' },
          },
          y: {
            ticks: { color: '#8899a6', font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    });
  } catch (err) {
    console.error('Failed to load charts:', err);
  }
}

// Load IP details (paths and user agents)
async function loadIpPathBreakdown(ip) {
  const container = document.getElementById('ipPathBreakdown');
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await fetchAPI('/admin/api/charts/ips/' + encodeURIComponent(ip) + '/details');

    if (data.paths.length === 0 && data.userAgents.length === 0) {
      container.innerHTML =
        '<p style="color: #8899a6; text-align: center;">No data for this IP</p>';
      return;
    }

    let html =
      '<p style="color: #8899a6; font-size: 11px; margin-bottom: 10px; text-align: center;">IP: ' +
      escapeHtml(ip) +
      '</p>';
    html += '<div style="max-height: 220px; overflow-y: auto;">';

    // Paths table
    if (data.paths.length > 0) {
      html +=
        '<p style="color: #fff; font-size: 12px; margin-bottom: 5px;"><strong>Paths:</strong></p>';
      html += '<table style="width: 100%; font-size: 12px; margin-bottom: 10px;">';
      html += '<tbody>';
      data.paths.forEach((item) => {
        const displayPath = item.path.length > 30 ? item.path.substring(0, 27) + '...' : item.path;
        html +=
          '<tr><td title="' +
          escapeHtml(item.path) +
          '">' +
          escapeHtml(displayPath) +
          '</td><td style="text-align: right;">' +
          item.count.toLocaleString() +
          '</td></tr>';
      });
      html += '</tbody></table>';
    }

    // User agents table
    if (data.userAgents.length > 0) {
      html +=
        '<p style="color: #fff; font-size: 12px; margin-bottom: 5px;"><strong>User Agents:</strong></p>';
      html += '<table style="width: 100%; font-size: 12px;">';
      html += '<tbody>';
      data.userAgents.forEach((item) => {
        const displayUa =
          item.userAgent.length > 30 ? item.userAgent.substring(0, 27) + '...' : item.userAgent;
        html +=
          '<tr><td title="' +
          escapeHtml(item.userAgent) +
          '">' +
          escapeHtml(displayUa) +
          '</td><td style="text-align: right;">' +
          item.count.toLocaleString() +
          '</td></tr>';
      });
      html += '</tbody></table>';
    }

    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div class="error">Failed to load IP details</div>';
  }
}

// Export functions
async function exportKeys() {
  try {
    const tier = document.getElementById('tierFilter').value;
    const active = document.getElementById('activeFilter').value;
    const search = document.getElementById('searchKeys').value;

    let url = '/admin/api/keys?';
    if (tier) url += 'tier=' + tier + '&';
    if (active) url += 'active=' + active + '&';
    if (search) url += 'search=' + encodeURIComponent(search);

    const keys = await fetchAPI(url);

    let csv = 'ID,Name,Email,Tier,Rate Limit,Requests,Status,Created,Last Used\n';
    keys.forEach((key) => {
      csv += '"' + key.id + '",';
      csv += '"' + (key.name || '').replace(/"/g, '""') + '",';
      csv += '"' + (key.email || '').replace(/"/g, '""') + '",';
      csv += '"' + key.tier + '",';
      csv += key.rateLimit + ',';
      csv += key.requestCount + ',';
      csv += '"' + (key.isActive ? 'Active' : 'Inactive') + '",';
      csv += '"' + key.createdAt + '",';
      csv += '"' + (key.lastUsedAt || '') + '"\n';
    });

    downloadCSV(csv, 'api-keys.csv');
    showSuccess('API keys exported successfully');
  } catch (err) {
    showError('Failed to export API keys');
  }
}

async function exportLogs() {
  try {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchLogs').value;

    let url = '/admin/api/logs?page=1&limit=1000';
    if (status === 'blocked') url += '&blocked=true';
    if (status === 'success') url += '&blocked=false';
    if (search) url += '&search=' + encodeURIComponent(search);

    const data = await fetchAPI(url);

    let csv = 'Time,Method,Path,IP,Tier,Status,Blocked,Rate Limit\n';
    data.logs.forEach((log) => {
      csv += '"' + log.createdAt + '",';
      csv += '"' + log.method + '",';
      csv += '"' + log.path.replace(/"/g, '""') + '",';
      csv += '"' + (log.ipAddress || '') + '",';
      csv += '"' + log.tier + '",';
      csv += log.responseStatus + ',';
      csv += (log.wasBlocked ? 'Yes' : 'No') + ',';
      csv += '"' + log.rateLimitRemaining + '/' + log.rateLimitLimit + '"\n';
    });

    downloadCSV(csv, 'request-logs.csv');
    showSuccess('Request logs exported successfully');
  } catch (err) {
    showError('Failed to export request logs');
  }
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Utility functions
function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeJs(text) {
  // Escape for use in JavaScript strings within HTML attributes
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function showError(message) {
  document.getElementById('errorContainer').innerHTML = '<div class="error">' + message + '</div>';
  setTimeout(() => {
    document.getElementById('errorContainer').innerHTML = '';
  }, 5000);
}

function showSuccess(message) {
  document.getElementById('successContainer').innerHTML =
    '<div class="success-message">' + message + '</div>';
  setTimeout(() => {
    document.getElementById('successContainer').innerHTML = '';
  }, 5000);
}

// Auto-refresh every 30 seconds
setInterval(() => {
  if (authToken && document.getElementById('dashboard').style.display !== 'none') {
    loadStats();
    loadCharts();
  }
}, 30000);

// ============================================
// BLOCKED IPs FUNCTIONALITY
// ============================================

let blockedPage = 1;
const blockedPageSize = 20;
let currentBlockedTab = 'all';

// Load blocked IPs stats
async function loadBlockedStats() {
  try {
    const data = await fetchAPI('/admin/api/blocked/stats');
    document.getElementById('activeAppBlocks').textContent = data.activeAppBlocks.toLocaleString();
    document.getElementById('activeFirewallBlocks').textContent =
      data.activeFirewallBlocks.toLocaleString();
    document.getElementById('blockedRequests24h').textContent =
      data.blockedRequests24h.toLocaleString();
    document.getElementById('trackedIps').textContent =
      data.abuseDetection.trackedIps.toLocaleString();

    // Update config inputs if config tab
    if (data.config) {
      document.getElementById('configMax429s').value = data.config.MAX_CONSECUTIVE_429S;
      document.getElementById('configBurstThreshold').value = data.config.BURST_THRESHOLD;
      document.getElementById('configSustainedThreshold').value =
        data.config.SUSTAINED_TRAFFIC_THRESHOLD;
      document.getElementById('configUaThreshold').value = data.config.USER_AGENT_THRESHOLD;
      document.getElementById('configInitialDuration').value = data.config.INITIAL_BLOCK_DURATION;
      document.getElementById('configRepeatDuration').value = data.config.REPEAT_BLOCK_DURATION;
      document.getElementById('configEscalationCount').value = data.config.ESCALATION_BLOCK_COUNT;
    }
  } catch (err) {
    console.error('Failed to load blocked stats:', err);
  }
}

// Load blocked IPs list
async function loadBlockedIps() {
  const level = document.getElementById('blockLevelFilter')?.value || '';
  const active = document.getElementById('blockActiveFilter')?.value || 'true';

  let url = '/admin/api/blocked?page=' + blockedPage + '&limit=' + blockedPageSize;
  if (level) url += '&level=' + level;
  if (active) url += '&active=' + active;

  try {
    const data = await fetchAPI(url);
    renderBlockedTable(data.blocks, data.total, data.page, data.totalPages);
  } catch (err) {
    document.getElementById('blockedTable').innerHTML =
      '<div class="error">Failed to load blocked IPs</div>';
  }
}

function renderBlockedTable(blocks, total, page, totalPages) {
  if (blocks.length === 0) {
    document.getElementById('blockedTable').innerHTML =
      '<p style="text-align: center; color: #8899a6; padding: 20px;">No blocked IPs found</p>';
    document.getElementById('blockedPagination').innerHTML = '';
    return;
  }

  let html = '<table><thead><tr>';
  html += '<th>IP Address</th>';
  html += '<th>Level</th>';
  html += '<th>Trigger</th>';
  html += '<th>Reason</th>';
  html += '<th>Blocked At</th>';
  html += '<th>Expires</th>';
  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  blocks.forEach((block) => {
    const isExpired = block.expiresAt && new Date(block.expiresAt) < new Date();
    const isActive = block.isActive && !isExpired;

    html += '<tr class="' + (isActive ? '' : 'expired-row') + '">';
    html += '<td class="key-display">' + escapeHtml(block.ipAddress) + '</td>';
    html +=
      '<td><span class="level-badge level-' +
      block.blockLevel +
      '">' +
      block.blockLevel +
      '</span></td>';
    html += '<td>' + formatTriggerType(block.triggerType) + '</td>';
    html +=
      '<td class="reason-cell" title="' +
      escapeHtml(block.reason) +
      '">' +
      truncate(block.reason, 30) +
      '</td>';
    html += '<td class="timestamp">' + formatDate(block.createdAt) + '</td>';
    html +=
      '<td class="timestamp">' +
      (block.expiresAt ? formatDate(block.expiresAt) : '<span style="color:#e0245e">Never</span>') +
      '</td>';
    html += '<td><div class="action-buttons">';
    html +=
      '<button class="secondary small" onclick="viewBlockDetails(\'' +
      block.id +
      '\')">View</button>';
    if (isActive) {
      html +=
        '<button class="danger small" onclick="removeBlock(\'' +
        block.id +
        "', '" +
        escapeJs(block.ipAddress) +
        '\')">Remove</button>';
      if (block.blockLevel === 'app') {
        html +=
          '<button class="warning small" onclick="escalateBlock(\'' +
          block.id +
          '\')">↑ Firewall</button>';
      }
    }
    html += '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('blockedTable').innerHTML = html;

  // Render pagination
  renderBlockedPagination(page, totalPages, total);
}

function renderBlockedPagination(page, totalPages, total) {
  if (totalPages <= 1) {
    document.getElementById('blockedPagination').innerHTML = '';
    return;
  }

  let html =
    '<div class="pagination-info">Page ' +
    page +
    ' of ' +
    totalPages +
    ' (' +
    total +
    ' total)</div>';
  html += '<div class="pagination-buttons">';

  if (page > 1) {
    html += '<button onclick="changeBlockedPage(' + (page - 1) + ')">← Previous</button>';
  }
  if (page < totalPages) {
    html += '<button onclick="changeBlockedPage(' + (page + 1) + ')">Next →</button>';
  }

  html += '</div>';
  document.getElementById('blockedPagination').innerHTML = html;
}

function changeBlockedPage(newPage) {
  blockedPage = newPage;
  loadBlockedIps();
}

// Load firewall blocks list
async function loadFirewallBlocks() {
  try {
    const data = await fetchAPI('/admin/api/blocked/firewall');
    renderFirewallCommands(data);
  } catch (err) {
    document.getElementById('firewallCommands').innerHTML =
      '<div class="error">Failed to load firewall blocks</div>';
  }
}

function renderFirewallCommands(data) {
  if (data.blocks.length === 0) {
    document.getElementById('firewallCommands').innerHTML =
      '<p style="text-align: center; color: #8899a6; padding: 20px;">No firewall-level blocks. IPs will appear here after repeated abuse.</p>';
    return;
  }

  let html = '<div class="firewall-list">';

  // Copy all button
  html += '<div class="firewall-actions">';
  html += '<button onclick="copyAllUfwCommands()">📋 Copy All UFW Commands</button>';
  html += '<span class="firewall-count">' + data.count + ' IPs to block</span>';
  html += '</div>';

  // Commands list
  html += '<div class="firewall-commands" id="ufwCommandsList">';
  data.ufwCommands.forEach((cmd) => {
    html += '<div class="firewall-command">';
    html += '<div class="firewall-ip">';
    html += '<span class="ip">' + escapeHtml(cmd.ip) + '</span>';
    html += '<span class="firewall-reason">' + escapeHtml(cmd.reason) + '</span>';
    html += '</div>';
    html += '<div class="firewall-cmd">';
    html += '<code>' + escapeHtml(cmd.command) + '</code>';
    html +=
      '<button class="small" onclick="copyToClipboard(\'' +
      escapeJs(cmd.command) +
      '\')">Copy</button>';
    html +=
      '<button class="danger small" onclick="removeBlockByIp(\'' +
      escapeJs(cmd.ip) +
      '\')">Remove</button>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';
  document.getElementById('firewallCommands').innerHTML = html;
}

function copyAllUfwCommands() {
  const commands = [];
  document.querySelectorAll('#ufwCommandsList code').forEach((el) => {
    commands.push(el.textContent);
  });
  copyToClipboard(commands.join('\n'));
  showSuccess('All UFW commands copied to clipboard!');
}

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // Already handled by caller if needed
    })
    .catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
}

// Switch between tabs
function switchBlockedTab(tab) {
  currentBlockedTab = tab;

  // Update tab buttons
  document.querySelectorAll('.blocked-tabs .tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Show/hide content
  document.getElementById('blockedAllTab').style.display = tab === 'all' ? 'block' : 'none';
  document.getElementById('blockedFirewallTab').style.display =
    tab === 'firewall' ? 'block' : 'none';
  document.getElementById('blockedConfigTab').style.display = tab === 'config' ? 'block' : 'none';

  // Load data for tab
  if (tab === 'all') {
    loadBlockedIps();
  } else if (tab === 'firewall') {
    loadFirewallBlocks();
  }
}

// Block IP modal
function showBlockIpModal() {
  document.getElementById('blockIpAddress').value = '';
  document.getElementById('blockIpLevel').value = 'app';
  document.getElementById('blockIpReason').value = '';
  document.getElementById('blockIpDuration').value = '60';
  document.getElementById('blockIpResult').innerHTML = '';
  document.getElementById('blockDurationContainer').style.display = 'block';
  openModal('blockIpModal');
}

// Toggle duration field based on level
document.getElementById('blockIpLevel')?.addEventListener('change', function () {
  const container = document.getElementById('blockDurationContainer');
  if (this.value === 'firewall') {
    container.style.display = 'none';
  } else {
    container.style.display = 'block';
  }
});

async function blockIp() {
  const ipAddress = document.getElementById('blockIpAddress').value.trim();
  const blockLevel = document.getElementById('blockIpLevel').value;
  const reason = document.getElementById('blockIpReason').value.trim();
  const durationMinutes = parseInt(document.getElementById('blockIpDuration').value) || null;

  if (!ipAddress) {
    document.getElementById('blockIpResult').innerHTML =
      '<div class="error">IP address is required</div>';
    return;
  }

  if (!reason) {
    document.getElementById('blockIpResult').innerHTML =
      '<div class="error">Reason is required</div>';
    return;
  }

  try {
    const body = { ipAddress, blockLevel, reason };
    if (blockLevel === 'app' && durationMinutes) {
      body.durationMinutes = durationMinutes;
    }

    await fetchAPI('/admin/api/blocked', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    document.getElementById('blockIpResult').innerHTML =
      '<div class="success-message">IP blocked successfully!</div>';
    loadBlockedStats();
    loadBlockedIps();

    setTimeout(() => {
      closeModal('blockIpModal');
    }, 1000);
  } catch (err) {
    document.getElementById('blockIpResult').innerHTML =
      '<div class="error">Failed to block IP</div>';
  }
}

async function removeBlock(blockId, ipAddress) {
  if (!confirm('Are you sure you want to remove the block for ' + ipAddress + '?')) {
    return;
  }

  try {
    await fetchAPI('/admin/api/blocked/' + blockId, {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'Manually removed via admin panel' }),
    });
    showSuccess('Block removed successfully');
    loadBlockedStats();
    loadBlockedIps();
    if (currentBlockedTab === 'firewall') {
      loadFirewallBlocks();
    }
  } catch (err) {
    showError('Failed to remove block');
  }
}

async function removeBlockByIp(ipAddress) {
  if (!confirm('Are you sure you want to remove the block for ' + ipAddress + '?')) {
    return;
  }

  try {
    await fetchAPI('/admin/api/blocked/ip/' + encodeURIComponent(ipAddress), {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'Manually removed via admin panel' }),
    });
    showSuccess('Block removed successfully');
    loadBlockedStats();
    loadBlockedIps();
    loadFirewallBlocks();
  } catch (err) {
    showError('Failed to remove block');
  }
}

async function escalateBlock(blockId) {
  if (
    !confirm(
      'Escalate this block to firewall level? This will make it permanent until manually removed.',
    )
  ) {
    return;
  }

  try {
    await fetchAPI('/admin/api/blocked/' + blockId + '/escalate', {
      method: 'POST',
    });
    showSuccess('Block escalated to firewall level');
    loadBlockedStats();
    loadBlockedIps();
  } catch (err) {
    showError('Failed to escalate block');
  }
}

async function viewBlockDetails(blockId) {
  try {
    // Get block and history
    const blocksData = await fetchAPI('/admin/api/blocked?active=');
    const block = blocksData.blocks.find((b) => b.id === blockId);

    if (!block) {
      showError('Block not found');
      return;
    }

    const history = await fetchAPI(
      '/admin/api/blocked/history/' + encodeURIComponent(block.ipAddress),
    );

    let html = '';

    // Block info
    html += '<div class="block-detail-section">';
    html += '<h4>Block Information</h4>';
    html +=
      '<div class="detail-row"><span class="detail-label">IP Address:</span><span class="detail-value key-display">' +
      escapeHtml(block.ipAddress) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Block Level:</span><span class="detail-value"><span class="level-badge level-' +
      block.blockLevel +
      '">' +
      block.blockLevel +
      '</span></span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Trigger Type:</span><span class="detail-value">' +
      formatTriggerType(block.triggerType) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Reason:</span><span class="detail-value">' +
      escapeHtml(block.reason) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Blocked At:</span><span class="detail-value">' +
      new Date(block.createdAt).toLocaleString() +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Expires At:</span><span class="detail-value">' +
      (block.expiresAt ? new Date(block.expiresAt).toLocaleString() : 'Never') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">' +
      (block.isActive
        ? '<span class="badge active">Active</span>'
        : '<span class="badge inactive">Inactive</span>') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Blocked Requests:</span><span class="detail-value">' +
      block.blockedRequestCount.toLocaleString() +
      '</span></div>';
    if (block.lastSeenAt) {
      html +=
        '<div class="detail-row"><span class="detail-label">Last Seen:</span><span class="detail-value">' +
        new Date(block.lastSeenAt).toLocaleString() +
        '</span></div>';
    }
    html += '</div>';

    // Trigger metadata
    if (block.consecutive429Count || block.requestsPerSecond || block.userAgentCount) {
      html += '<div class="block-detail-section">';
      html += '<h4>Trigger Details</h4>';
      if (block.consecutive429Count) {
        html +=
          '<div class="detail-row"><span class="detail-label">Consecutive 429s:</span><span class="detail-value">' +
          block.consecutive429Count +
          '</span></div>';
      }
      if (block.requestsPerSecond) {
        html +=
          '<div class="detail-row"><span class="detail-label">Requests/Second:</span><span class="detail-value">' +
          block.requestsPerSecond.toFixed(1) +
          '</span></div>';
      }
      if (block.userAgentCount) {
        html +=
          '<div class="detail-row"><span class="detail-label">User Agents:</span><span class="detail-value">' +
          block.userAgentCount +
          '</span></div>';
      }
      html += '</div>';
    }

    // Block history
    if (history.history.length > 1) {
      html += '<div class="block-detail-section">';
      html += '<h4>Block History (' + history.totalBlocks + ' total blocks)</h4>';
      html += '<div class="history-list">';
      history.history.forEach((h, i) => {
        if (i >= 5) return; // Show last 5
        html += '<div class="history-item">';
        html += '<span class="history-date">' + new Date(h.createdAt).toLocaleString() + '</span>';
        html += '<span class="level-badge level-' + h.blockLevel + '">' + h.blockLevel + '</span>';
        html += '<span class="history-trigger">' + formatTriggerType(h.triggerType) + '</span>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    document.getElementById('blockDetailsContent').innerHTML = html;
    openModal('blockDetailsModal');
  } catch (err) {
    showError('Failed to load block details');
  }
}

async function saveBlockConfig() {
  const config = {
    MAX_CONSECUTIVE_429S: parseInt(document.getElementById('configMax429s').value),
    BURST_THRESHOLD: parseInt(document.getElementById('configBurstThreshold').value),
    SUSTAINED_TRAFFIC_THRESHOLD: parseInt(
      document.getElementById('configSustainedThreshold').value,
    ),
    USER_AGENT_THRESHOLD: parseInt(document.getElementById('configUaThreshold').value),
    INITIAL_BLOCK_DURATION: parseInt(document.getElementById('configInitialDuration').value),
    REPEAT_BLOCK_DURATION: parseInt(document.getElementById('configRepeatDuration').value),
    ESCALATION_BLOCK_COUNT: parseInt(document.getElementById('configEscalationCount').value),
  };

  try {
    await fetchAPI('/admin/api/blocked/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
    showSuccess('Configuration saved (runtime only)');
    loadBlockedStats();
  } catch (err) {
    showError('Failed to save configuration');
  }
}

// Helper functions
function formatTriggerType(type) {
  const map = {
    consecutive_429s: '🔄 Consecutive 429s',
    sustained_traffic: '📈 Sustained Traffic',
    burst_traffic: '⚡ Burst Traffic',
    repeat_offender: '🔁 Repeat Offender',
    user_agent_cycling: '🎭 UA Cycling',
    manual: '👤 Manual',
  };
  return map[type] || type;
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return escapeHtml(str);
  return escapeHtml(str.substring(0, maxLen)) + '...';
}

// Update loadDashboard to include blocked stats
const originalLoadDashboard = loadDashboard;
loadDashboard = async function () {
  await originalLoadDashboard();
  loadBlockedStats();
  loadBlockedIps();
};
