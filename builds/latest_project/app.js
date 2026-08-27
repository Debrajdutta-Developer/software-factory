/**
 * APIForge Studio — Autonomous Micro-SaaS API & Mock Engine Core
 * Client-Side Stateful Mock Interceptor, AST Template Generator & SDK Synthesizer
 */

// Global Application State Store
const state = {
  projects: [],
  currentProjectId: null,
  activeEndpointId: null,
  selectedSdkLang: 'typescript',
  mockControls: {
    latency: 120,
    errorRate: 0,
    statefulDb: true
  },
  mockDb: {} // Dynamic local entity store: resourceName => Array of items
};

// Initial Preset Projects
const DEFAULT_PROJECTS = [
  {
    id: 'proj_pulse',
    name: 'PulseMetrics SaaS API',
    endpoints: [
      {
        id: 'ep_1',
        method: 'GET',
        path: '/api/v1/users',
        category: 'Users',
        description: 'List all registered team members',
        status: 200,
        responseBody: JSON.stringify([
          { id: 'usr_{{uuid}}', name: 'Alex Rivera', email: 'alex@pulse.io', role: 'Admin', createdAt: '{{date}}' },
          { id: 'usr_{{uuid}}', name: 'Samantha Chen', email: 'sam@pulse.io', role: 'Developer', createdAt: '{{date}}' }
        ], null, 2)
      },
      {
        id: 'ep_2',
        method: 'POST',
        path: '/api/v1/users',
        category: 'Users',
        description: 'Provision a new team user account',
        status: 201,
        responseBody: JSON.stringify({
          id: 'usr_{{uuid}}',
          name: 'New Teammate',
          email: 'user@pulse.io',
          status: 'Active',
          created: '{{date}}'
        }, null, 2)
      },
      {
        id: 'ep_3',
        method: 'GET',
        path: '/api/v1/metrics/summary',
        category: 'Analytics',
        description: 'Fetch real-time application uptime and request volume',
        status: 200,
        responseBody: JSON.stringify({
          uptimePercentage: 99.98,
          totalRequests24h: 1482900,
          avgLatencyMs: 42,
          activeClusters: ['us-east-1', 'eu-west-1', 'ap-southeast-1']
        }, null, 2)
      }
    ]
  },
  {
    id: 'proj_shop',
    name: 'ShopStream E-Commerce API',
    endpoints: [
      {
        id: 'ep_shop_1',
        method: 'GET',
        path: '/api/v1/products',
        category: 'Catalog',
        description: 'Retrieve product inventory catalogue',
        status: 200,
        responseBody: JSON.stringify([
          { id: 'prod_901', title: 'Ergonomic Mechanical Keyboard', price: 149.99, inStock: true },
          { id: 'prod_902', title: 'Ultra-Wide 4K Monitor 34"', price: 599.00, inStock: true }
        ], null, 2)
      }
    ]
  }
];

// Synthetic Mock Data Fuzzer Generator Core
const SyntheticFuzzer = {
  names: ['Alex Rivera', 'Jordan Lee', 'Taylor Swift', 'Samantha Chen', 'Morgan Freeman', 'Elena Rostova', 'Marcus Vance', 'Chloe Bennett'],
  domains: ['techflow.io', 'pulse.dev', 'cloudsystem.net', 'nexuscore.org', 'hyperdata.com'],
  products: ['Wireless Noise-Canceling Headphones', 'Smart Health Watch', '4K UltraHD Web Camera', 'Ergonomic Desk Chair', 'Developer Mechanical Keyboard'],
  
  getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  
  generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  generateDate() {
    const d = new Date(Date.now() - Math.floor(Math.random() * 10000000000));
    return d.toISOString();
  },

  generateSingleRecord(presetType, index = 1) {
    const uuid = this.generateUuid();
    const date = this.generateDate();

    if (presetType === 'users') {
      const name = this.getRandom(this.names);
      const email = `${name.toLowerCase().replace(' ', '.')}@${this.getRandom(this.domains)}`;
      return {
        id: `usr_${uuid.slice(0, 8)}`,
        name,
        email,
        role: index % 3 === 0 ? 'Admin' : 'Engineer',
        status: 'Active',
        createdAt: date
      };
    } else if (presetType === 'ecommerce') {
      return {
        id: `prod_${100 + index}`,
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        title: this.getRandom(this.products),
        price: parseFloat((Math.random() * 200 + 19.99).toFixed(2)),
        inStock: Math.random() > 0.2,
        createdAt: date
      };
    } else if (presetType === 'finance') {
      return {
        transactionId: `tx_${uuid.slice(0, 10)}`,
        amount: parseFloat((Math.random() * 1500 + 10).toFixed(2)),
        currency: 'USD',
        status: index % 5 === 0 ? 'FAILED' : 'COMPLETED',
        merchant: 'Stripe Gateway',
        timestamp: date
      };
    } else if (presetType === 'iot') {
      return {
        deviceId: `sensor-node-${index}`,
        temperatureC: parseFloat((20 + Math.random() * 12).toFixed(1)),
        humidityPct: Math.floor(40 + Math.random() * 40),
        batteryPct: Math.floor(60 + Math.random() * 40),
        status: 'OPERATIONAL',
        timestamp: date
      };
    }
    return { id: uuid, index, timestamp: date };
  },

  // AST Template Evaluator for custom templates {{uuid}}, {{name}}, etc.
  parseTemplate(templateString, context = {}) {
    if (!templateString) return '';
    return templateString.replace(/\{\{([^}]+)\}\}/g, (match, tag) => {
      const trimmed = tag.trim();
      if (trimmed === 'uuid') return this.generateUuid();
      if (trimmed === 'name') return this.getRandom(this.names);
      if (trimmed === 'email') return `user_${Math.floor(Math.random()*1000)}@${this.getRandom(this.domains)}`;
      if (trimmed === 'date') return new Date().toISOString();
      if (trimmed === 'price') return (Math.random() * 100).toFixed(2);
      if (trimmed.startsWith('req.params.')) {
        const paramKey = trimmed.replace('req.params.', '');
        return context.params ? (context.params[paramKey] || `[${paramKey}]`) : `[${paramKey}]`;
      }
      return match;
    });
  }
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadProjectsFromStorage();
  initUIEventListeners();
  renderProjectSelect();
  renderEndpointList();
  renderSandboxQuickChips();
  renderSdkCode();
  renderOpenApiSpec();
});

// Storage Management
function loadProjectsFromStorage() {
  const stored = localStorage.getItem('apiforge_projects');
  if (stored) {
    try {
      state.projects = JSON.parse(stored);
    } catch (e) {
      state.projects = DEFAULT_PROJECTS;
    }
  } else {
    state.projects = DEFAULT_PROJECTS;
    saveProjectsToStorage();
  }

  if (state.projects.length > 0) {
    state.currentProjectId = state.projects[0].id;
    if (state.projects[0].endpoints.length > 0) {
      state.activeEndpointId = state.projects[0].endpoints[0].id;
    }
  }
}

function saveProjectsToStorage() {
  localStorage.setItem('apiforge_projects', JSON.stringify(state.projects));
}

function getCurrentProject() {
  return state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];
}

// UI Event Binding
function initUIEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(`tab-${tabId}`).classList.add('active');

      if (tabId === 'sdk') renderSdkCode();
      if (tabId === 'openapi') renderOpenApiSpec();
      if (tabId === 'sandbox') renderSandboxQuickChips();
    });
  });

  // Project Switcher
  const projSelect = document.getElementById('projectSelect');
  projSelect.addEventListener('change', (e) => {
    state.currentProjectId = e.target.value;
    const proj = getCurrentProject();
    state.activeEndpointId = proj.endpoints.length > 0 ? proj.endpoints[0].id : null;
    renderEndpointList();
    renderEndpointEditor();
    renderSandboxQuickChips();
    renderSdkCode();
    renderOpenApiSpec();
  });

  document.getElementById('btnNewProject').addEventListener('click', () => {
    const name = prompt('Enter New Project Name:', 'Microservice API');
    if (name) {
      const newProj = {
        id: 'proj_' + Date.now(),
        name,
        endpoints: []
      };
      state.projects.push(newProj);
      state.currentProjectId = newProj.id;
      saveProjectsToStorage();
      renderProjectSelect();
      renderEndpointList();
      showToast('Project created successfully!');
    }
  });

  // Import / Export Workspace
  document.getElementById('btnExportProject').addEventListener('click', exportProjectJson);
  document.getElementById('btnImportProject').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', handleImportFile);

  // Mock Controls Sliders
  const latencyRange = document.getElementById('latencyRange');
  const latencyVal = document.getElementById('latencyValue');
  latencyRange.addEventListener('input', (e) => {
    state.mockControls.latency = parseInt(e.target.value);
    latencyVal.textContent = `${state.mockControls.latency}ms`;
  });

  const errorRateRange = document.getElementById('errorRateRange');
  const errorRateVal = document.getElementById('errorRateValue');
  errorRateRange.addEventListener('input', (e) => {
    state.mockControls.errorRate = parseInt(e.target.value);
    errorRateVal.textContent = `${state.mockControls.errorRate}%`;
  });

  document.getElementById('toggleStatefulDb').addEventListener('change', (e) => {
    state.mockControls.statefulDb = e.target.checked;
    showToast(`Stateful CRUD storage ${e.target.checked ? 'Enabled' : 'Disabled'}`);
  });

  // Endpoint Editor Events
  document.getElementById('btnCreateEndpoint').addEventListener('click', () => {
    openModal('modalNewEndpoint');
  });

  document.getElementById('btnConfirmCreateEndpoint').addEventListener('click', createNewEndpoint);

  document.getElementById('btnSaveEndpoint').addEventListener('click', saveCurrentEndpointDetails);
  document.getElementById('btnDeleteEndpoint').addEventListener('click', deleteCurrentEndpoint);

  // Sandbox Events
  document.getElementById('sbSendBtn').addEventListener('click', executeSandboxRequest);
  document.getElementById('btnAddHeader').addEventListener('click', addHeaderKvRow);
  document.getElementById('btnClearLogs').addEventListener('click', () => {
    document.getElementById('sandboxLogsConsole').innerHTML = '';
  });

  // Sandbox Request Card Sub-tabs
  document.querySelectorAll('.sb-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.sb-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sb-tab-content').forEach(c => c.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.getAttribute('data-sb-tab');
      document.getElementById(`sb-tab-${target}`).classList.add('active');
    });
  });

  // Data Fuzzer Events
  document.getElementById('btnGenerateFuzz').addEventListener('click', generateFuzzerData);
  document.getElementById('fuzzPreset').addEventListener('change', (e) => {
    const customGroup = document.getElementById('customFuzzTemplateGroup');
    customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
  });
  document.getElementById('btnCopyFuzz').addEventListener('click', () => {
    const text = document.getElementById('fuzzOutputText').value;
    navigator.clipboard.writeText(text);
    showToast('Mock data copied to clipboard!');
  });
  document.getElementById('btnDownloadFuzz').addEventListener('click', downloadFuzzFile);

  // SDK Generator Events
  document.querySelectorAll('.sdk-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sdk-lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedSdkLang = btn.getAttribute('data-lang');
      renderSdkCode();
    });
  });
  document.getElementById('btnCopySdk').addEventListener('click', () => {
    const code = document.getElementById('sdkCodeDisplay').textContent;
    navigator.clipboard.writeText(code);
    showToast('SDK code copied to clipboard!');
  });

  // OpenAPI Specs Export Events
  document.getElementById('btnCopyOpenApi').addEventListener('click', () => {
    const spec = document.getElementById('openApiSpecDisplay').value;
    navigator.clipboard.writeText(spec);
    showToast('OpenAPI Spec copied!');
  });
  document.getElementById('btnDownloadOpenApi').addEventListener('click', () => {
    const spec = document.getElementById('openApiSpecDisplay').value;
    downloadFile('openapi.json', spec, 'application/json');
  });

  // Filter Search
  document.getElementById('endpointSearch').addEventListener('input', (e) => {
    renderEndpointList(e.target.value.toLowerCase());
  });
}

// Render Project Dropdown
function renderProjectSelect() {
  const select = document.getElementById('projectSelect');
  select.innerHTML = '';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === state.currentProjectId) opt.selected = true;
    select.appendChild(opt);
  });
}

// Render Endpoint Left Sidebar List
function renderEndpointList(filterTerm = '') {
  const container = document.getElementById('endpointList');
  const countBadge = document.getElementById('endpointCount');
  const proj = getCurrentProject();

  container.innerHTML = '';
  const filtered = proj.endpoints.filter(ep => 
    ep.path.toLowerCase().includes(filterTerm) || 
    ep.method.toLowerCase().includes(filterTerm) ||
    (ep.category && ep.category.toLowerCase().includes(filterTerm))
  );

  countBadge.textContent = proj.endpoints.length;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 1.5rem;"><p>No endpoints found.</p></div>`;
    renderEndpointEditor();
    return;
  }

  filtered.forEach(ep => {
    const div = document.createElement('div');
    div.className = `endpoint-item ${ep.id === state.activeEndpointId ? 'active' : ''}`;
    div.innerHTML = `
      <span class="method-tag method-${ep.method.toLowerCase()}">${ep.method}</span>
      <div class="endpoint-info">
        <span class="endpoint-path font-mono">${ep.path}</span>
        <span class="endpoint-desc">${ep.description || ep.category || 'No description'}</span>
      </div>
    `;
    div.addEventListener('click', () => {
      state.activeEndpointId = ep.id;
      renderEndpointList(filterTerm);
      renderEndpointEditor();
    });
    container.appendChild(div);
  });

  renderEndpointEditor();
}

// Render Main Endpoint Editor Form
function renderEndpointEditor() {
  const proj = getCurrentProject();
  const ep = proj.endpoints.find(e => e.id === state.activeEndpointId);
  
  const emptyState = document.getElementById('editorEmptyState');
  const editorForm = document.getElementById('editorForm');

  if (!ep) {
    emptyState.style.display = 'flex';
    editorForm.classList.add('hidden');
    return;
  }

  emptyState.style.display = 'none';
  editorForm.classList.remove('hidden');

  document.getElementById('editorMethodBadge').textContent = ep.method;
  document.getElementById('editorMethodBadge').className = `method-tag method-${ep.method.toLowerCase()}`;
  document.getElementById('editPath').value = ep.path;
  document.getElementById('editMethod').value = ep.method;
  document.getElementById('editStatus').value = ep.status || 200;
  document.getElementById('editCategory').value = ep.category || '';
  document.getElementById('editDescription').value = ep.description || '';
  document.getElementById('editResponseBody').value = ep.responseBody || '{\n}';
}

function saveCurrentEndpointDetails() {
  const proj = getCurrentProject();
  const ep = proj.endpoints.find(e => e.id === state.activeEndpointId);
  if (!ep) return;

  ep.path = document.getElementById('editPath').value;
  ep.method = document.getElementById('editMethod').value;
  ep.status = parseInt(document.getElementById('editStatus').value);
  ep.category = document.getElementById('editCategory').value;
  ep.description = document.getElementById('editDescription').value;
  ep.responseBody = document.getElementById('editResponseBody').value;

  saveProjectsToStorage();
  renderEndpointList();
  renderSandboxQuickChips();
  showToast('Endpoint saved successfully!');
}

function deleteCurrentEndpoint() {
  const proj = getCurrentProject();
  if (!confirm('Are you sure you want to delete this endpoint?')) return;

  proj.endpoints = proj.endpoints.filter(e => e.id !== state.activeEndpointId);
  state.activeEndpointId = proj.endpoints.length > 0 ? proj.endpoints[0].id : null;
  saveProjectsToStorage();
  renderEndpointList();
  renderSandboxQuickChips();
  showToast('Endpoint deleted.');
}

function createNewEndpoint() {
  const method = document.getElementById('newMethod').value;
  const path = document.getElementById('newPath').value.trim() || '/api/v1/resource';
  const category = document.getElementById('newCategory').value.trim() || 'General';
  const description = document.getElementById('newDescription').value.trim();

  const proj = getCurrentProject();
  const newEp = {
    id: 'ep_' + Date.now(),
    method,
    path,
    category,
    description,
    status: method === 'POST' ? 201 : 200,
    responseBody: JSON.stringify({ message: 'Success', timestamp: '{{date}}' }, null, 2)
  };

  proj.endpoints.push(newEp);
  state.activeEndpointId = newEp.id;
  saveProjectsToStorage();
  closeModal('modalNewEndpoint');
  renderEndpointList();
  renderSandboxQuickChips();
  showToast('New route endpoint created!');
}

function insertTemplateTag(tag) {
  const textarea = document.getElementById('editResponseBody');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + tag + text.substring(end);
  textarea.focus();
}

// Sandbox API Execution Engine
function renderSandboxQuickChips() {
  const proj = getCurrentProject();
  const container = document.getElementById('quickRouteChips');
  container.innerHTML = '';

  proj.endpoints.forEach(ep => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${ep.method} ${ep.path}`;
    chip.addEventListener('click', () => {
      document.getElementById('sbMethod').value = ep.method;
      document.getElementById('sbUrl').value = ep.path;
      if (ep.method === 'POST' || ep.method === 'PUT') {
        document.getElementById('sbRequestBody').value = JSON.stringify({ name: 'Sample Payload', active: true }, null, 2);
      }
    });
    container.appendChild(chip);
  });
}

function addHeaderKvRow() {
  const container = document.getElementById('headersKv');
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML = `
    <input type="text" class="text-input font-mono kv-key" placeholder="Key">
    <input type="text" class="text-input font-mono kv-value" placeholder="Value">
    <button class="btn-icon btn-remove-kv">&times;</button>
  `;
  row.querySelector('.btn-remove-kv').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

// Dynamic Virtual HTTP Interceptor Core
async function executeSandboxRequest() {
  const method = document.getElementById('sbMethod').value;
  const urlPath = document.getElementById('sbUrl').value.trim();
  const resMeta = document.getElementById('responseMeta');
  const resStatus = document.getElementById('resStatus');
  const resTime = document.getElementById('resTime');
  const resSize = document.getElementById('resSize');
  const resDisplay = document.getElementById('responseBodyDisplay');

  logToConsole(`Sending Request: ${method} ${urlPath}`, 'info');

  const startTime = performance.now();

  // Simulated latency
  if (state.mockControls.latency > 0) {
    await new Promise(resolve => setTimeout(resolve, state.mockControls.latency));
  }

  // Simulated Error Rate check
  if (state.mockControls.errorRate > 0) {
    const rolled = Math.random() * 100;
    if (rolled < state.mockControls.errorRate) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(0);
      resMeta.style.display = 'flex';
      resStatus.textContent = '500 Internal Server Error (Simulated Fault)';
      resStatus.className = 'res-status-badge status-5xx';
      resTime.textContent = `${duration} ms`;
      resSize.textContent = '0.2 KB';
      resDisplay.textContent = JSON.stringify({ error: 'Simulated server latency fault or chaos injection.' }, null, 2);
      logToConsole(`Request Failed (Simulated Fault): 500 Server Error`, 'error');
      return;
    }
  }

  // Match Endpoint Route
  const proj = getCurrentProject();
  const matchedEndpoint = proj.endpoints.find(ep => {
    return ep.method === method && matchRoutePath(ep.path, urlPath);
  });

  let responseBodyObj = null;
  let statusCode = 200;

  if (matchedEndpoint) {
    statusCode = matchedEndpoint.status || 200;
    const pathParams = extractRouteParams(matchedEndpoint.path, urlPath);
    
    // Stateful CRUD dynamic storage logic
    if (state.mockControls.statefulDb) {
      responseBodyObj = handleStatefulCrud(method, matchedEndpoint.path, pathParams, matchedEndpoint.responseBody);
    } else {
      const parsedBodyStr = SyntheticFuzzer.parseTemplate(matchedEndpoint.responseBody, { params: pathParams });
      try {
        responseBodyObj = JSON.parse(parsedBodyStr);
      } catch (e) {
        responseBodyObj = { raw: parsedBodyStr };
      }
    }
  } else {
    // 404 Not Found Fallback
    statusCode = 404;
    responseBodyObj = { error: 'Route not found in Mock Engine specification.', path: urlPath, method };
  }

  const endTime = performance.now();
  const duration = (endTime - startTime).toFixed(0);
  const jsonString = JSON.stringify(responseBodyObj, null, 2);
  const sizeKb = (new Blob([jsonString]).size / 1024).toFixed(2);

  resMeta.style.display = 'flex';
  resStatus.textContent = `${statusCode} ${statusCode < 300 ? 'OK' : 'Error'}`;
  resStatus.className = `res-status-badge status-${statusCode < 300 ? '2xx' : statusCode < 500 ? '4xx' : '5xx'}`;
  resTime.textContent = `${duration} ms`;
  resSize.textContent = `${sizeKb} KB`;

  resDisplay.textContent = jsonString;
  logToConsole(`Response Received: Status ${statusCode} (${duration} ms)`, statusCode < 300 ? 'success' : 'error');
}

// Simple dynamic route matching engine (/api/v1/users/:id)
function matchRoutePath(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean);
  const uParts = path.split('/').filter(Boolean);
  if (pParts.length !== uParts.length) return false;

  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) continue;
    if (pParts[i] !== uParts[i]) return false;
  }
  return true;
}

function extractRouteParams(pattern, path) {
  const params = {};
  const pParts = pattern.split('/').filter(Boolean);
  const uParts = path.split('/').filter(Boolean);

  pParts.forEach((part, idx) => {
    if (part.startsWith(':')) {
      params[part.slice(1)] = uParts[idx];
    }
  });
  return params;
}

// In-Memory Stateful CRUD Database Handler
function handleStatefulCrud(method, pathPattern, params, defaultTemplate) {
  const resourceKey = pathPattern.split('/')[3] || 'resource';

  if (!state.mockDb[resourceKey]) {
    // Initialize default resource collection from template
    try {
      const parsed = JSON.parse(SyntheticFuzzer.parseTemplate(defaultTemplate, { params }));
      state.mockDb[resourceKey] = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      state.mockDb[resourceKey] = [];
    }
  }

  const collection = state.mockDb[resourceKey];

  if (method === 'GET') {
    if (params.id) {
      const item = collection.find(i => String(i.id) === String(params.id));
      return item || { error: 'Item not found in stateful memory' };
    }
    return collection;
  } else if (method === 'POST') {
    let newPayload = { id: `id_${Date.now()}`, createdAt: new Date().toISOString() };
    try {
      const bodyInput = document.getElementById('sbRequestBody').value;
      if (bodyInput) newPayload = { ...newPayload, ...JSON.parse(bodyInput) };
    } catch (e) {}
    collection.push(newPayload);
    return newPayload;
  } else if (method === 'DELETE') {
    if (params.id) {
      state.mockDb[resourceKey] = collection.filter(i => String(i.id) !== String(params.id));
      return { success: true, deletedId: params.id };
    }
    return { success: true };
  }

  return JSON.parse(SyntheticFuzzer.parseTemplate(defaultTemplate, { params }));
}

function logToConsole(message, type = 'info') {
  const consoleEl = document.getElementById('sandboxLogsConsole');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Data Fuzzer Generator UI
function generateFuzzerData() {
  const preset = document.getElementById('fuzzPreset').value;
  const count = parseInt(document.getElementById('fuzzCount').value) || 10;
  const format = document.getElementById('fuzzFormat').value;

  const records = [];
  for (let i = 1; i <= count; i++) {
    records.push(SyntheticFuzzer.generateSingleRecord(preset, i));
  }

  let outputStr = '';
  if (format === 'json') {
    outputStr = JSON.stringify(records, null, 2);
  } else if (format === 'csv') {
    if (records.length > 0) {
      const keys = Object.keys(records[0]);
      outputStr += keys.join(',') + '\n';
      records.forEach(r => {
        outputStr += keys.map(k => `"${r[k]}"`).join(',') + '\n';
      });
    }
  } else if (format === 'sql') {
    const table = preset === 'users' ? 'users' : preset === 'ecommerce' ? 'products' : 'records';
    records.forEach(r => {
      const keys = Object.keys(r).join(', ');
      const vals = Object.values(r).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
      outputStr += `INSERT INTO ${table} (${keys}) VALUES (${vals});\n`;
    });
  }

  document.getElementById('fuzzOutputText').value = outputStr;
  showToast(`Generated ${count} synthetic records.`);
}

function downloadFuzzFile() {
  const text = document.getElementById('fuzzOutputText').value;
  const format = document.getElementById('fuzzFormat').value;
  const mime = format === 'json' ? 'application/json' : 'text/plain';
  downloadFile(`synthetic_dataset.${format}`, text, mime);
}

// Multi-Language SDK Code Synthesizer Core
function renderSdkCode() {
  const proj = getCurrentProject();
  const titleEl = document.getElementById('sdkLangTitle');
  const display = document.getElementById('sdkCodeDisplay');

  const lang = state.selectedSdkLang;

  if (lang === 'typescript') {
    titleEl.textContent = 'TypeScript Async Client SDK';
    display.textContent = generateTypeScriptSdk(proj);
  } else if (lang === 'javascript') {
    titleEl.textContent = 'JavaScript (Axios) Client SDK';
    display.textContent = generateJavaScriptSdk(proj);
  } else if (lang === 'python') {
    titleEl.textContent = 'Python (Requests) Client Library';
    display.textContent = generatePythonSdk(proj);
  } else if (lang === 'go') {
    titleEl.textContent = 'Go (net/http) Client Package';
    display.textContent = generateGoSdk(proj);
  } else if (lang === 'curl') {
    titleEl.textContent = 'cURL Command Script';
    display.textContent = generateCurlScript(proj);
  }
}

function generateTypeScriptSdk(proj) {
  let code = `/**\n * Auto-generated API Client for ${proj.name}\n * Synthesized by APIForge Studio\n */\n\n`;
  code += `export class ApiClient {\n  constructor(private baseUrl: string = 'http://localhost:3000', private token?: string) {}\n\n`;
  code += `  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {\n`;
  code += `    const headers = {\n      'Content-Type': 'application/json',\n      ...(this.token ? { 'Authorization': \`Bearer \${this.token}\` } : {}),\n      ...options.headers,\n    };\n`;
  code += `    const response = await fetch(\`\${this.baseUrl}\${path}\`, { ...options, headers });\n`;
  code += `    if (!response.ok) throw new Error(\`API Request Failed: \${response.statusText}\`);\n`;
  code += `    return response.json();\n  }\n\n`;

  proj.endpoints.forEach((ep, idx) => {
    const methodName = ep.path.replace(/\/api\/v1\//, '').replace(/[\/:-]/g, '_') + `_${ep.method.toLowerCase()}`;
    code += `  /**\n   * ${ep.description || ep.path}\n   */\n`;
    code += `  async ${methodName}(payload?: any): Promise<any> {\n`;
    code += `    return this.request<any>('${ep.path}', {\n      method: '${ep.method}',\n      ...(payload ? { body: JSON.stringify(payload) } : {})\n    });\n  }\n\n`;
  });

  code += `}\n`;
  return code;
}

function generateJavaScriptSdk(proj) {
  let code = `// ${proj.name} — JavaScript Axios SDK\nimport axios from 'axios';\n\n`;
  code += `export class ${proj.name.replace(/[^a-zA-Z0-9]/g, '')}Client {\n`;
  code += `  constructor(baseURL = 'http://localhost:3000', authToken = null) {\n`;
  code += `    this.client = axios.create({\n      baseURL,\n      headers: authToken ? { Authorization: \`Bearer \${authToken}\` } : {}\n    });\n  }\n\n`;

  proj.endpoints.forEach(ep => {
    const fnName = ep.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');
    code += `  async ${ep.method.toLowerCase()}_${fnName}(data = null) {\n`;
    code += `    const res = await this.client({\n      url: '${ep.path}',\n      method: '${ep.method}',\n      data\n    });\n`;
    code += `    return res.data;\n  }\n\n`;
  });

  code += `}\n`;
  return code;
}

function generatePythonSdk(proj) {
  let code = `# Auto-Generated Python Client for ${proj.name}\nimport requests\nfrom typing import Any, Dict, Optional\n\n`;
  code += `class ApiClient:\n`;
  code += `    def __init__(self, base_url: str = "http://localhost:3000", api_key: Optional[str] = None):\n`;
  code += `        self.base_url = base_url\n`;
  code += `        self.session = requests.Session()\n`;
  code += `        if api_key:\n`;
  code += `            self.session.headers.update({"Authorization": f"Bearer {api_key}"})\n\n`;

  proj.endpoints.forEach(ep => {
    const fnName = ep.method.toLowerCase() + '_' + ep.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');
    code += `    def ${fnName}(self, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:\n`;
    code += `        """${ep.description || ep.path}"""\n`;
    code += `        url = f"{self.base_url}${ep.path}"\n`;
    code += `        res = self.session.request("${ep.method}", url, json=payload)\n`;
    code += `        res.raise_for_status()\n`;
    code += `        return res.json()\n\n`;
  });

  return code;
}

function generateGoSdk(proj) {
  let code = `// Package client provides Go bindings for ${proj.name}\npackage client\n\nimport (\n\t"bytes"\n\t"encoding/json"\n\t"fmt"\n\t"net/http"\n)\n\n`;
  code += `type Client struct {\n\tBaseURL    string\n\tHTTPClient *http.Client\n}\n\n`;
  code += `func NewClient(baseURL string) *Client {\n\treturn &Client{\n\t\tBaseURL: baseURL,\n\t\tHTTPClient: &http.Client{},\n\t}\n}\n`;

  proj.endpoints.forEach(ep => {
    const fnName = ep.method + ep.path.replace(/[^a-zA-Z0-9]/g, '');
    code += `\nfunc (c *Client) ${fnName}(body interface{}) (*http.Response, error) {\n`;
    code += `\tjsonBytes, _ := json.Marshal(body)\n`;
    code += `\treq, err := http.NewRequest("${ep.method}", c.BaseURL+"${ep.path}", bytes.NewBuffer(jsonBytes))\n`;
    code += `\tif err != nil { return nil, err }\n`;
    code += `\treq.Header.Set("Content-Type", "application/json")\n`;
    code += `\treturn c.HTTPClient.Do(req)\n}\n`;
  });

  return code;
}

function generateCurlScript(proj) {
  let code = `#!/bin/bash\n# cURL Request Suite for ${proj.name}\n\nHOST="http://localhost:3000"\n\n`;
  proj.endpoints.forEach(ep => {
    code += `# ${ep.description || ep.path}\n`;
    code += `curl -X ${ep.method} "$HOST${ep.path}" \\\n  -H "Content-Type: application/json"`;
    if (ep.method === 'POST' || ep.method === 'PUT') {
      code += ` \\\n  -d '{"sample": "data"}'`;
    }
    code += `\n\n`;
  });
  return code;
}

// OpenAPI 3.0 Spec Synthesizer
function renderOpenApiSpec() {
  const proj = getCurrentProject();
  const spec = {
    openapi: '3.0.0',
    info: {
      title: proj.name,
      version: '1.0.0',
      description: 'OpenAPI specification generated autonomously by APIForge Studio.'
    },
    paths: {}
  };

  proj.endpoints.forEach(ep => {
    if (!spec.paths[ep.path]) spec.paths[ep.path] = {};

    let parsedExample = {};
    try {
      parsedExample = JSON.parse(ep.responseBody);
    } catch(e) {}

    spec.paths[ep.path][ep.method.toLowerCase()] = {
      summary: ep.description || `${ep.method} ${ep.path}`,
      tags: [ep.category || 'Default'],
      responses: {
        [ep.status || 200]: {
          description: 'Successful Response',
          content: {
            'application/json': {
              example: parsedExample
            }
          }
        }
      }
    };
  });

  document.getElementById('openApiSpecDisplay').value = JSON.stringify(spec, null, 2);
}

// Workspace Backup Import/Export
function exportProjectJson() {
  const proj = getCurrentProject();
  downloadFile(`${proj.name.toLowerCase().replace(/\s+/g, '_')}_workspace.json`, JSON.stringify(proj, null, 2), 'application/json');
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedProj = JSON.parse(e.target.result);
      if (importedProj.name && Array.isArray(importedProj.endpoints)) {
        importedProj.id = 'proj_' + Date.now();
        state.projects.push(importedProj);
        state.currentProjectId = importedProj.id;
        saveProjectsToStorage();
        renderProjectSelect();
        renderEndpointList();
        showToast('Project workspace imported!');
      } else {
        showToast('Invalid workspace JSON format', 'error');
      }
    } catch (err) {
      showToast('Error parsing JSON file', 'error');
    }
  };
  reader.readAsText(file);
}

// Helper Utilities
function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}