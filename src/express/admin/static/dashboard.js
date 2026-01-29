// Dashboard state
let authToken = null;
let currentPage = 1;
const pageSize = 50;
let trendsChart = null;
let tierChart = null;
let pathsChart = null;
let ipsChart = null;
let userAgentsChart = null;

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
  html += '<th>Name</th>';
  html += '<th>Email</th>';
  html += '<th>Tier</th>';
  html += '<th>Requests</th>';
  html += '<th>Rate Limit</th>';
  html += '<th>Last Used</th>';
  html += '<th>Status</th>';
  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  keys.forEach((key) => {
    html += '<tr>';
    html += '<td><strong>' + escapeHtml(key.name) + '</strong></td>';
    html += '<td>' + escapeHtml(key.email || 'N/A') + '</td>';
    html += '<td><span class="badge ' + key.tier + '">' + key.tier + '</span></td>';
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
      escapeHtml(key.name) +
      '\')">Delete</button>';
    html += '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('keysTable').innerHTML = html;
}

async function viewKey(keyId) {
  try {
    const key = await fetchAPI('/admin/api/keys/' + keyId);
    const logs = await fetchAPI('/admin/api/keys/' + keyId + '/logs?limit=10');

    let html = '';
    html +=
      '<div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value key-display">' +
      key.id +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">' +
      escapeHtml(key.name) +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">' +
      escapeHtml(key.email || 'N/A') +
      '</span></div>';
    html +=
      '<div class="detail-row"><span class="detail-label">Tier:</span><span class="detail-value"><span class="badge ' +
      key.tier +
      '">' +
      key.tier +
      '</span></span></div>';
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

    if (key.minecraftName) {
      html +=
        '<div class="detail-row"><span class="detail-label">Minecraft:</span><span class="detail-value">' +
        escapeHtml(key.minecraftName) +
        '</span></div>';
    }

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

async function toggleKeyStatus(keyId, newStatus) {
  try {
    await fetchAPI('/admin/api/keys/' + keyId, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: newStatus }),
    });
    showSuccess('API key ' + (newStatus ? 'enabled' : 'disabled') + ' successfully');
    loadKeys();
    loadStats();
  } catch (err) {
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
  html += '<th>Tier</th>';
  html += '<th>Status</th>';
  html += '<th>Rate Limit</th>';
  html += '</tr></thead><tbody>';

  logs.forEach((log) => {
    const blocked = log.wasBlocked;
    html += '<tr' + (blocked ? ' style="background: rgba(224, 36, 94, 0.1);"' : '') + '>';
    html += '<td class="timestamp">' + formatDate(log.createdAt) + '</td>';
    html += '<td><strong>' + log.method + '</strong></td>';
    html += '<td class="key-display">' + escapeHtml(log.path) + '</td>';
    html += '<td class="key-display">' + (log.ipAddress || 'N/A') + '</td>';
    html += '<td><span class="badge ' + log.tier + '">' + log.tier + '</span></td>';
    html +=
      '<td>' +
      (blocked ? '<span class="badge inactive">Blocked</span>' : log.responseStatus) +
      '</td>';
    html += '<td>' + log.rateLimitRemaining + '/' + log.rateLimitLimit + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('logsTable').innerHTML = html;
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
