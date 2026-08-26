/**
 * PayloadRelay - Engine & Application Controller
 * Fully autonomous, zero-dependency, local-first API studio & synthesizer.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Database, UI State & Event Controllers
  PayloadRelayDB.init().then(() => {
    AppNavigation.init();
    RequestBuilderModule.init();
    PayloadStudioModule.init();
    DataSynthesizerModule.init();
    JWTInspectorModule.init();
  });
});

/* ==========================================================================
   1. Local Persistence Layer (IndexedDB Engine)
   ========================================================================== */
const PayloadRelayDB = (() => {
  const DB_NAME = 'PayloadRelayDB';
  const DB_VERSION = 1;
  let db = null;

  function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('history')) {
          database.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      request.onerror = (e) => {
        console.warn('IndexedDB unavailable, falling back to in-memory/localStorage.', e);
        resolve(null);
      };
    });
  }

  function addHistoryRecord(record) {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      store.add({
        timestamp: new Date().toISOString(),
        ...record
      });
      tx.oncomplete = () => resolve();
    });
  }

  function getHistoryRecords(limit = 20) {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        resolve(results.reverse().slice(0, limit));
      };
    });
  }

  function clearHistory() {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readwrite');
      const store = tx.objectStore('history');
      store.clear();
      tx.oncomplete = () => resolve();
    });
  }

  return { init, addHistoryRecord, getHistoryRecords, clearHistory };
})();

/* ==========================================================================
   2. UI Helper Utilities (Toast Notifications, Syntax Highlighting)
   ========================================================================== */
const UI = {
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  highlightJSON(jsonObj) {
    if (typeof jsonObj !== 'string') {
      jsonObj = JSON.stringify(jsonObj, null, 2);
    }
    if (!jsonObj) return '';
    jsonObj = jsonObj.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return jsonObj.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
  },

  copyToClipboard(text, successMsg = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
      UI.showToast(successMsg, 'success');
    }).catch(err => {
      UI.showToast('Failed to copy to clipboard', 'danger');
    });
  }
};

/* ==========================================================================
   3. Tab & Navigation Controller
   ========================================================================== */
const AppNavigation = (() => {
  function init() {
    // Top Tabs
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        navButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });

    // Subtabs Setup
    document.querySelectorAll('.subtabs-bar').forEach(bar => {
      const subBtns = bar.querySelectorAll('.subtab-btn');
      subBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetSub = btn.getAttribute('data-subtab');
          const parent = bar.parentElement;
          bar.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
          parent.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));

          btn.classList.add('active');
          const targetPane = document.getElementById(targetSub);
          if (targetPane) targetPane.classList.add('active');
        });
      });
    });
  }

  return { init };
})();

/* ==========================================================================
   4. Request Builder & Virtual Network Interceptor
   ========================================================================== */
const RequestBuilderModule = (() => {
  const methodEl = document.getElementById('req-method');
  const urlEl = document.getElementById('req-url');
  const btnSend = document.getElementById('btn-send-request');
  const chkVirtualMock = document.getElementById('chk-virtual-mock');
  const headersTbody = document.getElementById('headers-tbody');
  const btnAddHeader = document.getElementById('btn-add-header');
  const authTypeEl = document.getElementById('auth-type');
  const authFieldsEl = document.getElementById('auth-fields');
  const reqBodyInput = document.getElementById('req-body-input');
  const latencyInput = document.getElementById('input-latency');
  const lblLatency = document.getElementById('lbl-latency');
  const mockStatusCodeEl = document.getElementById('mock-status-code');
  const exportLangEl = document.getElementById('select-export-lang');
  const codeExportPreview = document.getElementById('code-export-preview');

  // Response UI elements
  const resStatusBadge = document.getElementById('res-status-badge');
  const resTimeBadge = document.getElementById('res-time-badge');
  const resSizeBadge = document.getElementById('res-size-badge');
  const resBodyPreview = document.getElementById('res-body-preview');
  const resHeadersTbody = document.getElementById('res-headers-tbody');
  const resHeadersCount = document.getElementById('res-headers-count');
  const historyContainer = document.getElementById('history-list-container');

  function init() {
    // Dynamic event bindings
    btnAddHeader.addEventListener('click', addHeaderRow);
    headersTbody.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-row')) {
        e.target.closest('tr').remove();
        updateHeaderCount();
        updateCodeExport();
      }
    });

    headersTbody.addEventListener('input', () => {
      updateHeaderCount();
      updateCodeExport();
    });

    authTypeEl.addEventListener('change', renderAuthFields);
    renderAuthFields();

    latencyInput.addEventListener('input', (e) => {
      lblLatency.textContent = e.target.value;
    });

    btnSend.addEventListener('click', executeRequest);
    
    document.getElementById('btn-format-req-body').addEventListener('click', () => {
      try {
        const parsed = JSON.parse(reqBodyInput.value);
        reqBodyInput.value = JSON.stringify(parsed, null, 2);
        UI.showToast('JSON Formatted', 'info');
      } catch (e) {
        UI.showToast('Invalid JSON in body', 'danger');
      }
    });

    document.getElementById('btn-sample-req-body').addEventListener('click', () => {
      reqBodyInput.value = JSON.stringify({
        product_id: "prod_881",
        quantity: 3,
        payment_method: "CARD_VISA",
        customer: { id: "c_102", email: "client@example.com" }
      }, null, 2);
      updateCodeExport();
    });

    // cURL Modal Setup
    const curlModal = document.getElementById('modal-curl');
    document.getElementById('btn-quick-curl').addEventListener('click', () => curlModal.classList.add('open'));
    document.getElementById('btn-close-curl-modal').addEventListener('click', () => curlModal.classList.remove('open'));
    document.getElementById('btn-cancel-curl').addEventListener('click', () => curlModal.classList.remove('open'));
    document.getElementById('btn-parse-curl-submit').addEventListener('click', parseAndLoadCurl);

    document.getElementById('btn-clear-history').addEventListener('click', () => {
      PayloadRelayDB.clearHistory().then(() => {
        renderHistoryList();
        UI.showToast('Request history cleared', 'info');
      });
    });

    document.getElementById('btn-copy-response').addEventListener('click', () => {
      UI.copyToClipboard(resBodyPreview.textContent);
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      UI.copyToClipboard(codeExportPreview.textContent);
    });

    exportLangEl.addEventListener('change', updateCodeExport);
    methodEl.addEventListener('change', updateCodeExport);
    urlEl.addEventListener('input', updateCodeExport);
    reqBodyInput.addEventListener('input', updateCodeExport);

    updateCodeExport();
    renderHistoryList();
  }

  function addHeaderRow(key = '', val = '', checked = true) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" ${checked ? 'checked' : ''} class="kv-check"></td>
      <td><input type="text" class="input-cell kv-key" value="${key}" placeholder="Key"></td>
      <td><input type="text" class="input-cell kv-val" value="${val}" placeholder="Value"></td>
      <td><button class="btn-icon btn-remove-row">&times;</button></td>
    `;
    headersTbody.appendChild(tr);
    updateHeaderCount();
    updateCodeExport();
  }

  function updateHeaderCount() {
    const activeHeaders = headersTbody.querySelectorAll('.kv-check:checked').length;
    document.getElementById('count-headers').textContent = activeHeaders;
  }

  function getHeadersObject() {
    const headers = {};
    headersTbody.querySelectorAll('tr').forEach(tr => {
      const check = tr.querySelector('.kv-check');
      const key = tr.querySelector('.kv-key').value.trim();
      const val = tr.querySelector('.kv-val').value.trim();
      if (check && check.checked && key) {
        headers[key] = val;
      }
    });

    // Auth header insertion
    const type = authTypeEl.value;
    if (type === 'bearer') {
      const token = document.getElementById('auth-token')?.value || '';
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } else if (type === 'basic') {
      const u = document.getElementById('auth-user')?.value || '';
      const p = document.getElementById('auth-pass')?.value || '';
      if (u || p) headers['Authorization'] = `Basic ${btoa(u + ':' + p)}`;
    } else if (type === 'apikey') {
      const k = document.getElementById('auth-key-name')?.value || 'X-API-Key';
      const v = document.getElementById('auth-key-val')?.value || '';
      if (k && v) headers[k] = v;
    }

    return headers;
  }

  function renderAuthFields() {
    const type = authTypeEl.value;
    authFieldsEl.innerHTML = '';
    if (type === 'bearer') {
      authFieldsEl.innerHTML = `
        <div class="form-group margin-v">
          <label>Bearer Token</label>
          <input type="text" id="auth-token" placeholder="eyJhbGciOi..." class="select-full">
        </div>
      `;
    } else if (type === 'basic') {
      authFieldsEl.innerHTML = `
        <div class="config-row" style="padding:0; border:none; margin-top:0.5rem;">
          <input type="text" id="auth-user" placeholder="Username" class="flex-1">
          <input type="text" id="auth-pass" placeholder="Password" class="flex-1">
        </div>
      `;
    } else if (type === 'apikey') {
      authFieldsEl.innerHTML = `
        <div class="config-row" style="padding:0; border:none; margin-top:0.5rem;">
          <input type="text" id="auth-key-name" value="X-API-Key" class="flex-1">
          <input type="text" id="auth-key-val" placeholder="Value" class="flex-1">
        </div>
      `;
    }
  }

  async function executeRequest() {
    const method = methodEl.value;
    const url = urlEl.value.trim();
    const headers = getHeadersObject();
    const isMock = chkVirtualMock.checked;
    const bodyStr = ['POST', 'PUT', 'PATCH'].includes(method) ? reqBodyInput.value : null;

    if (!url) {
      UI.showToast('Please enter a target URL', 'warning');
      return;
    }

    const startTime = performance.now();
    resStatusBadge.className = 'metric-badge status-neutral';
    resStatusBadge.textContent = 'Status: Sending...';

    if (isMock) {
      const latency = parseInt(latencyInput.value, 10) || 100;
      const mockStatus = parseInt(mockStatusCodeEl.value, 10);
      
      setTimeout(() => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        const mockPayload = {
          _relay_mode: "VIRTUAL_MOCK_INTERCEPTOR",
          status: mockStatus >= 400 ? "error" : "success",
          simulated_at: new Date().toISOString(),
          request_summary: { method, url, headers_count: Object.keys(headers).length },
          mock_data: bodyStr ? (safeJSONParse(bodyStr) || bodyStr) : { message: "Mock endpoint response simulation" }
        };

        const resStr = JSON.stringify(mockPayload, null, 2);
        displayResponse(mockStatus, duration, resStr.length, { 'Content-Type': 'application/json', 'X-Simulated-By': 'PayloadRelay' }, resStr);
        
        PayloadRelayDB.addHistoryRecord({ method, url, status: mockStatus, duration, isMock: true }).then(renderHistoryList);
      }, latency);

      return;
    }

    // Real HTTP Fetch Call
    try {
      const options = { method, headers };
      if (bodyStr) options.body = bodyStr;

      const response = await fetch(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      const resHeaders = {};
      response.headers.forEach((val, key) => { resHeaders[key] = val; });

      const text = await response.text();
      let formattedText = text;
      try {
        const json = JSON.parse(text);
        formattedText = JSON.stringify(json, null, 2);
      } catch (e) {}

      displayResponse(response.status, duration, text.length, resHeaders, formattedText);
      PayloadRelayDB.addHistoryRecord({ method, url, status: response.status, duration, isMock: false }).then(renderHistoryList);

    } catch (err) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      const errorMsg = JSON.stringify({ error: "Network / CORS Fetch Failed", message: err.message, hint: "Check target server CORS settings or switch to Virtual Mock Mode." }, null, 2);
      displayResponse(0, duration, errorMsg.length, {}, errorMsg);
    }
  }

  function displayResponse(status, duration, sizeBytes, headers, bodyText) {
    resStatusBadge.textContent = `Status: ${status || 'ERR'}`;
    resStatusBadge.className = 'metric-badge ' + (status >= 200 && status < 300 ? 'status-2xx' : (status >= 400 ? 'status-4xx' : ''));
    resTimeBadge.textContent = `Time: ${duration}ms`;
    resSizeBadge.textContent = `Size: ${sizeBytes} B`;

    // Response Body Syntax Highlighting
    if (bodyText.startsWith('{') || bodyText.startsWith('[')) {
      resBodyPreview.innerHTML = UI.highlightJSON(bodyText);
    } else {
      resBodyPreview.textContent = bodyText;
    }

    // Headers Table
    resHeadersTbody.innerHTML = '';
    const headerKeys = Object.keys(headers);
    resHeadersCount.textContent = headerKeys.length;
    if (headerKeys.length === 0) {
      resHeadersTbody.innerHTML = '<tr><td colspan="2" class="empty-state">No headers received</td></tr>';
    } else {
      headerKeys.forEach(k => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${k}</strong></td><td>${headers[k]}</td>`;
        resHeadersTbody.appendChild(tr);
      });
    }
  }

  function updateCodeExport() {
    const lang = exportLangEl.value;
    const method = methodEl.value;
    const url = urlEl.value.trim();
    const headers = getHeadersObject();
    const bodyStr = reqBodyInput.value;

    let snippet = '';

    if (lang === 'fetch') {
      snippet = `fetch("${url}", {\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 4)},\n`;
      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyStr) {
        snippet += `  body: JSON.stringify(${bodyStr.trim()})\n`;
      }
      snippet += `})\n.then(res => res.json())\n.then(data => console.log(data));`;
    } else if (lang === 'python') {
      snippet = `import requests\n\nurl = "${url}"\nheaders = ${JSON.stringify(headers, null, 4)}\n`;
      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyStr) {
        snippet += `payload = ${bodyStr.trim()}\nresponse = requests.${method.toLowerCase()}(url, json=payload, headers=headers)\n`;
      } else {
        snippet += `response = requests.${method.toLowerCase()}(url, headers=headers)\n`;
      }
      snippet += `print(response.status_code)\nprint(response.json())`;
    } else if (lang === 'curl') {
      snippet = `curl -X ${method} "${url}" \\\n`;
      Object.keys(headers).forEach(k => {
        snippet += `  -H "${k}: ${headers[k]}" \\\n`;
      });
      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyStr) {
        snippet += `  -d '${bodyStr.replace(/\n/g, '')}'`;
      }
    } else if (lang === 'go') {
      snippet = `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"io"\n)\n\nfunc main() {\n\treq, _ := http.NewRequest("${method}", "${url}", nil)\n`;
      Object.keys(headers).forEach(k => {
        snippet += `\treq.Header.Set("${k}", "${headers[k]}")\n`;
      });
      snippet += `\tres, err := http.DefaultClient.Do(req)\n\tif err != nil { return }\n\tdefer res.Body.Close()\n\tbody, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(body))\n}`;
    }

    codeExportPreview.textContent = snippet;
  }

  function parseAndLoadCurl() {
    const curlRaw = document.getElementById('curl-import-input').value.trim();
    if (!curlRaw) return;

    try {
      let method = 'GET';
      let url = '';
      const headers = {};
      let body = '';

      // Parse method
      const methodMatch = curlRaw.match(/-X\s+([A-Z]+)/i);
      if (methodMatch) method = methodMatch[1].toUpperCase();

      // Parse URL
      const urlMatch = curlRaw.match(/https?:\/\/[^\s'"]+/);
      if (urlMatch) url = urlMatch[0];

      // Parse Headers
      const headerMatches = [...curlRaw.matchAll(/-H\s+['"]([^'"]+)['"]/g)];
      headerMatches.forEach(m => {
        const parts = m[1].split(':');
        if (parts.length >= 2) {
          headers[parts[0].trim()] = parts.slice(1).join(':').trim();
        }
      });

      // Parse Data Body
      const bodyMatch = curlRaw.match(/(-d|--data|--data-raw)\s+['"]([^'"]+)['"]/);
      if (bodyMatch) {
        body = bodyMatch[2];
        if (method === 'GET') method = 'POST';
      }

      if (url) urlEl.value = url;
      methodEl.value = method;

      // Render headers to table
      headersTbody.innerHTML = '';
      Object.keys(headers).forEach(k => addHeaderRow(k, headers[k], true));

      if (body) {
        const formatted = safeJSONParse(body);
        reqBodyInput.value = formatted ? JSON.stringify(formatted, null, 2) : body;
      }

      document.getElementById('modal-curl').classList.remove('open');
      UI.showToast('cURL Imported successfully', 'success');
      updateCodeExport();
    } catch (e) {
      UI.showToast('Failed to parse cURL command', 'danger');
    }
  }

  function renderHistoryList() {
    PayloadRelayDB.getHistoryRecords(15).then(records => {
      historyContainer.innerHTML = '';
      if (records.length === 0) {
        historyContainer.innerHTML = '<div class="empty-state">No request history recorded yet.</div>';
        return;
      }
      records.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
          <span class="history-method status-2xx">${item.method}</span>
          <span class="history-url">${item.url}</span>
          <span class="metric-badge">${item.status || 'MOCK'}</span>
        `;
        div.addEventListener('click', () => {
          methodEl.value = item.method;
          urlEl.value = item.url;
          UI.showToast('Loaded from history', 'info');
        });
        historyContainer.appendChild(div);
      });
    });
  }

  function safeJSONParse(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  return { init };
})();

/* ==========================================================================
   5. Payload Studio & Multi-Format Code Generator Engine
   ========================================================================== */
const PayloadStudioModule = (() => {
  const inputJson = document.getElementById('studio-json-input');
  const targetSelect = document.getElementById('select-schema-target');
  const schemaOutput = document.getElementById('studio-schema-output');
  const jsonStatus = document.getElementById('studio-json-status');

  function init() {
    inputJson.addEventListener('input', processSchemaConversion);
    targetSelect.addEventListener('change', processSchemaConversion);

    document.getElementById('btn-studio-format').addEventListener('click', () => {
      try {
        const parsed = JSON.parse(inputJson.value);
        inputJson.value = JSON.stringify(parsed, null, 2);
        processSchemaConversion();
        UI.showToast('Prettified JSON', 'info');
      } catch (e) {
        UI.showToast('Invalid JSON structure', 'danger');
      }
    });

    document.getElementById('btn-studio-minify').addEventListener('click', () => {
      try {
        const parsed = JSON.parse(inputJson.value);
        inputJson.value = JSON.stringify(parsed);
        processSchemaConversion();
        UI.showToast('Minified JSON', 'info');
      } catch (e) {
        UI.showToast('Invalid JSON structure', 'danger');
      }
    });

    document.getElementById('btn-studio-sample').addEventListener('click', () => {
      inputJson.value = JSON.stringify({
        account_id: 55410,
        name: "Enterprise Account",
        is_verified: true,
        features: ["SSO", "AUDIT_LOGS", "API_ACCESS"],
        billing: { plan: "scale", amount_usd: 299.99, is_auto_renew: true }
      }, null, 2);
      processSchemaConversion();
    });

    document.getElementById('btn-copy-schema').addEventListener('click', () => {
      UI.copyToClipboard(schemaOutput.textContent);
    });

    processSchemaConversion();
  }

  function processSchemaConversion() {
    const raw = inputJson.value.trim();
    if (!raw) {
      schemaOutput.textContent = '// Paste JSON to generate code/schema';
      jsonStatus.innerHTML = '<span class="status-neutral">Empty Input</span>';
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
      jsonStatus.innerHTML = '<span class="status-valid" style="color:var(--success)">✓ Valid JSON</span>';
    } catch (e) {
      jsonStatus.innerHTML = `<span class="status-invalid" style="color:var(--danger)">✗ Invalid JSON: ${e.message}</span>`;
      schemaOutput.textContent = `// JSON Syntax Error: ${e.message}`;
      return;
    }

    const target = targetSelect.value;
    let result = '';

    if (target === 'json-schema') {
      result = JSON.stringify(generateJSONSchema(parsed), null, 2);
    } else if (target === 'typescript') {
      result = generateTypeScript(parsed, 'RootPayload');
    } else if (target === 'zod') {
      result = generateZodSchema(parsed, 'rootSchema');
    } else if (target === 'pydantic') {
      result = generatePydantic(parsed, 'RootModel');
    } else if (target === 'rust') {
      result = generateRustStruct(parsed, 'RootPayload');
    }

    schemaOutput.textContent = result;
  }

  // Schema Generation Engines
  function generateJSONSchema(val) {
    function getType(o) {
      if (o === null) return "null";
      if (Array.isArray(o)) return "array";
      return typeof o;
    }

    function buildSchema(o) {
      const type = getType(o);
      if (type === 'object') {
        const properties = {};
        const required = [];
        for (const k in o) {
          properties[k] = buildSchema(o[k]);
          required.push(k);
        }
        return { type: "object", properties, required };
      } else if (type === 'array') {
        const items = o.length > 0 ? buildSchema(o[0]) : {};
        return { type: "array", items };
      }
      return { type };
    }

    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "GeneratedSchema",
      ...buildSchema(val)
    };
  }

  function generateTypeScript(obj, interfaceName = 'RootPayload') {
    let result = '';
    const subInterfaces = [];

    function parseType(v, name) {
      if (v === null) return 'any';
      if (Array.isArray(v)) {
        if (v.length === 0) return 'any[]';
        return `${parseType(v[0], name + 'Item')}[]`;
      }
      if (typeof v === 'object') {
        const childName = capitalize(name);
        let fields = '{\n';
        for (const k in v) {
          fields += `  ${k}: ${parseType(v[k], k)};\n`;
        }
        fields += '}';
        subInterfaces.push(`export interface ${childName} ${fields}`);
        return childName;
      }
      return typeof v;
    }

    const rootType = parseType(obj, interfaceName);
    if (!subInterfaces.length) {
      return `export type ${interfaceName} = ${rootType};`;
    }
    return subInterfaces.join('\n\n');
  }

  function generateZodSchema(obj, schemaName = 'rootSchema') {
    let code = "import { z } from 'zod';\n\n";

    function parse(v) {
      if (v === null) return "z.null()";
      if (typeof v === 'number') return "z.number()";
      if (typeof v === 'boolean') return "z.boolean()";
      if (typeof v === 'string') return "z.string()";
      if (Array.isArray(v)) {
        const itemType = v.length > 0 ? parse(v[0]) : "z.any()";
        return `z.array(${itemType})`;
      }
      if (typeof v === 'object') {
        let props = 'z.object({\n';
        for (const k in v) {
          props += `  ${k}: ${parse(v[k])},\n`;
        }
        props += '})';
        return props;
      }
      return "z.any()";
    }

    code += `export const ${schemaName} = ${parse(obj)};`;
    return code;
  }

  function generatePydantic(obj, className = 'RootModel') {
    let code = "from pydantic import BaseModel\nfrom typing import List, Optional, Any\n\n";
    const models = [];

    function parse(v, name) {
      if (v === null) return "Optional[Any]";
      if (typeof v === 'number') return Number.isInteger(v) ? "int" : "float";
      if (typeof v === 'boolean') return "bool";
      if (typeof v === 'string') return "str";
      if (Array.isArray(v)) {
        const item = v.length > 0 ? parse(v[0], name + "Item") : "Any";
        return `List[${item}]`;
      }
      if (typeof v === 'object') {
        const cName = capitalize(name);
        let fields = `class ${cName}(BaseModel):\n`;
        for (const k in v) {
          fields += `    ${k}: ${parse(v[k], k)}\n`;
        }
        models.push(fields);
        return cName;
      }
      return "Any";
    }

    parse(obj, className);
    return code + models.join('\n');
  }

  function generateRustStruct(obj, structName = 'RootPayload') {
    let code = "use serde::{Serialize, Deserialize};\n\n";
    const structs = [];

    function parse(v, name) {
      if (v === null) return "Option<String>";
      if (typeof v === 'number') return Number.isInteger(v) ? "i64" : "f64";
      if (typeof v === 'boolean') return "bool";
      if (typeof v === 'string') return "String";
      if (Array.isArray(v)) {
        const item = v.length > 0 ? parse(v[0], name + "Item") : "String";
        return `Vec<${item}>`;
      }
      if (typeof v === 'object') {
        const sName = capitalize(name);
        let fields = `#[derive(Serialize, Deserialize, Debug)]\npub struct ${sName} {\n`;
        for (const k in v) {
          fields += `    pub ${k}: ${parse(v[k], k)},\n`;
        }
        fields += '}';
        structs.push(fields);
        return sName;
      }
      return "String";
    }

    parse(obj, structName);
    return code + structs.join('\n\n');
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/[^a-zA-Z0-9]/g, '');
  }

  return { init };
})();

/* ==========================================================================
   6. Synthetic Mock Data Generator Engine
   ========================================================================== */
const DataSynthesizerModule = (() => {
  const fieldsContainer = document.getElementById('synth-fields-container');
  const recordCountInput = document.getElementById('synth-record-count');
  const rootWrapperSelect = document.getElementById('synth-root-wrapper');
  const previewOutput = document.getElementById('synth-output-preview');

  let activeFields = [
    { key: 'id', type: 'uuid' },
    { key: 'customer_email', type: 'email' },
    { key: 'total_amount', type: 'float' },
    { key: 'status', type: 'enum', extra: 'PENDING, COMPLETED, REFUNDED' },
    { key: 'created_at', type: 'timestamp' }
  ];

  function init() {
    renderFieldRows();

    document.getElementById('btn-add-synth-field').addEventListener('click', () => {
      activeFields.push({ key: `field_${activeFields.length + 1}`, type: 'string' });
      renderFieldRows();
    });

    document.getElementById('btn-synth-generate').addEventListener('click', generateDataset);

    // Presets
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        loadPreset(btn.getAttribute('data-preset'));
      });
    });

    document.getElementById('btn-copy-synth').addEventListener('click', () => {
      UI.copyToClipboard(previewOutput.textContent);
    });

    document.getElementById('btn-download-synth-json').addEventListener('click', () => downloadFile('synthetic_data.json', previewOutput.textContent, 'application/json'));
    document.getElementById('btn-download-synth-csv').addEventListener('click', exportCSV);

    generateDataset();
  }

  function renderFieldRows() {
    fieldsContainer.innerHTML = '';
    activeFields.forEach((field, idx) => {
      const row = document.createElement('div');
      row.className = 'synth-field-row';
      row.innerHTML = `
        <input type="text" value="${field.key}" class="input-cell synth-key" placeholder="Field Key" style="flex:1;">
        <select class="synth-type" style="flex:1;">
          <option value="uuid" ${field.type === 'uuid' ? 'selected' : ''}>UUID v4</option>
          <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email Address</option>
          <option value="name" ${field.type === 'name' ? 'selected' : ''}>Full Name</option>
          <option value="integer" ${field.type === 'integer' ? 'selected' : ''}>Random Int (1-1000)</option>
          <option value="float" ${field.type === 'float' ? 'selected' : ''}>Random Float (10-500)</option>
          <option value="boolean" ${field.type === 'boolean' ? 'selected' : ''}>Boolean (true/false)</option>
          <option value="timestamp" ${field.type === 'timestamp' ? 'selected' : ''}>ISO Timestamp</option>
          <option value="enum" ${field.type === 'enum' ? 'selected' : ''}>Custom Enum (CSV)</option>
          <option value="string" ${field.type === 'string' ? 'selected' : ''}>Generic String</option>
        </select>
        ${field.type === 'enum' ? `<input type="text" value="${field.extra || ''}" class="input-cell synth-extra" placeholder="A, B, C" style="flex:1;">` : ''}
        <button class="btn-icon btn-del-field" data-idx="${idx}">&times;</button>
      `;

      // Event listeners for inline field modification
      row.querySelector('.synth-key').addEventListener('input', (e) => { activeFields[idx].key = e.target.value; });
      row.querySelector('.synth-type').addEventListener('change', (e) => {
        activeFields[idx].type = e.target.value;
        renderFieldRows();
      });
      const extraInp = row.querySelector('.synth-extra');
      if (extraInp) {
        extraInp.addEventListener('input', (e) => { activeFields[idx].extra = e.target.value; });
      }
      row.querySelector('.btn-del-field').addEventListener('click', () => {
        activeFields.splice(idx, 1);
        renderFieldRows();
      });

      fieldsContainer.appendChild(row);
    });
  }

  function loadPreset(presetKey) {
    if (presetKey === 'ecommerce') {
      activeFields = [
        { key: 'order_id', type: 'uuid' },
        { key: 'customer', type: 'name' },
        { key: 'email', type: 'email' },
        { key: 'subtotal', type: 'float' },
        { key: 'status', type: 'enum', extra: 'PAID, SHIPPED, DELIVERED' },
        { key: 'date', type: 'timestamp' }
      ];
    } else if (presetKey === 'saas_user') {
      activeFields = [
        { key: 'user_id', type: 'uuid' },
        { key: 'full_name', type: 'name' },
        { key: 'work_email', type: 'email' },
        { key: 'role', type: 'enum', extra: 'ADMIN, DEVELOPER, VIEWER' },
        { key: 'is_verified', type: 'boolean' }
      ];
    } else if (presetKey === 'iot') {
      activeFields = [
        { key: 'sensor_id', type: 'uuid' },
        { key: 'temperature_c', type: 'float' },
        { key: 'humidity_percent', type: 'integer' },
        { key: 'active', type: 'boolean' },
        { key: 'recorded_at', type: 'timestamp' }
      ];
    } else if (presetKey === 'fintech') {
      activeFields = [
        { key: 'tx_hash', type: 'uuid' },
        { key: 'amount', type: 'float' },
        { key: 'currency', type: 'enum', extra: 'USD, EUR, GBP, JPY' },
        { key: 'settled', type: 'boolean' },
        { key: 'timestamp', type: 'timestamp' }
      ];
    }
    renderFieldRows();
    generateDataset();
  }

  function generateDataset() {
    const count = Math.min(Math.max(parseInt(recordCountInput.value, 10) || 10, 1), 500);
    const wrapper = rootWrapperSelect.value;
    const records = [];

    const names = ['Alex Rivera', 'Jordan Smith', 'Taylor Chen', 'Morgan Vance', 'Casey Dakota', 'Sam Taylor'];
    const domains = ['techcorp.io', 'devstudio.org', 'cloudapp.net', 'company.com'];

    for (let i = 0; i < count; i++) {
      const obj = {};
      activeFields.forEach(f => {
        if (!f.key) return;
        if (f.type === 'uuid') obj[f.key] = generateUUID();
        else if (f.type === 'name') obj[f.key] = names[Math.floor(Math.random() * names.length)];
        else if (f.type === 'email') obj[f.key] = `user_${Math.floor(Math.random()*900+100)}@${domains[Math.floor(Math.random()*domains.length)]}`;
        else if (f.type === 'integer') obj[f.key] = Math.floor(Math.random() * 1000) + 1;
        else if (f.type === 'float') obj[f.key] = parseFloat((Math.random() * 490 + 10).toFixed(2));
        else if (f.type === 'boolean') obj[f.key] = Math.random() > 0.5;
        else if (f.type === 'timestamp') obj[f.key] = new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString();
        else if (f.type === 'enum') {
          const opts = (f.extra || 'DEFAULT').split(',').map(s => s.trim());
          obj[f.key] = opts[Math.floor(Math.random() * opts.length)];
        }
        else obj[f.key] = `sample_${i + 1}`;
      });
      records.push(obj);
    }

    let result = '';
    if (wrapper === 'array') {
      result = JSON.stringify(records, null, 2);
    } else if (wrapper === 'envelope') {
      result = JSON.stringify({
        total_records: count,
        page: 1,
        data: records
      }, null, 2);
    } else if (wrapper === 'ndjson') {
      result = records.map(r => JSON.stringify(r)).join('\n');
    }

    previewOutput.innerHTML = UI.highlightJSON(result);
    window._latestSyntheticRecords = records;
  }

  function exportCSV() {
    const records = window._latestSyntheticRecords;
    if (!records || !records.length) {
      UI.showToast('No records available to export', 'warning');
      return;
    }
    const headers = Object.keys(records[0]);
    let csv = headers.join(',') + '\n';
    records.forEach(r => {
      csv += headers.map(h => JSON.stringify(r[h] ?? '')).join(',') + '\n';
    });
    downloadFile('synthetic_data.csv', csv, 'text/csv');
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast(`Downloaded ${filename}`, 'success');
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return { init };
})();

/* ==========================================================================
   7. JWT Decoder & Security Header Auditor Module
   ========================================================================== */
const JWTInspectorModule = (() => {
  const jwtInput = document.getElementById('jwt-input-token');
  const jwtValidBadge = document.getElementById('jwt-valid-badge');
  const jwtTimeInfo = document.getElementById('jwt-time-info');
  const jwtHeaderOut = document.getElementById('jwt-header-out');
  const jwtPayloadOut = document.getElementById('jwt-payload-out');

  const headersInput = document.getElementById('security-headers-input');
  const btnAudit = document.getElementById('btn-audit-headers');
  const auditContainer = document.getElementById('audit-results-container');

  function init() {
    jwtInput.addEventListener('input', parseJWT);
    btnAudit.addEventListener('click', auditHeaders);

    // Initial default sample JWT
    jwtInput.value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsZXggRGV2IiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.signature";
    parseJWT();
  }

  function parseJWT() {
    const token = jwtInput.value.trim();
    if (!token) {
      jwtValidBadge.textContent = "Waiting for Token";
      jwtValidBadge.className = "badge";
      jwtTimeInfo.textContent = "--";
      jwtHeaderOut.textContent = "{}";
      jwtPayloadOut.textContent = "{}";
      return;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      jwtValidBadge.textContent = "Invalid JWT Format";
      jwtValidBadge.className = "badge status-4xx";
      jwtTimeInfo.textContent = "JWT must contain 3 dot-separated segments.";
      return;
    }

    try {
      const header = JSON.parse(base64UrlDecode(parts[0]));
      const payload = JSON.parse(base64UrlDecode(parts[1]));

      jwtHeaderOut.innerHTML = UI.highlightJSON(header);
      jwtPayloadOut.innerHTML = UI.highlightJSON(payload);

      jwtValidBadge.textContent = "Decoded Successfully";
      jwtValidBadge.className = "badge status-2xx";

      // Expiration checks
      if (payload.exp) {
        const expTime = payload.exp * 1000;
        const now = Date.now();
        if (now > expTime) {
          jwtTimeInfo.textContent = `❌ Expired at: ${new Date(expTime).toLocaleString()}`;
        } else {
          const diffMinutes = Math.round((expTime - now) / 60000);
          jwtTimeInfo.textContent = `✓ Valid (Expires in ${diffMinutes} minutes)`;
        }
      } else {
        jwtTimeInfo.textContent = "No 'exp' claim found in payload.";
      }
    } catch (e) {
      jwtValidBadge.textContent = "Decoding Error";
      jwtValidBadge.className = "badge status-4xx";
      jwtTimeInfo.textContent = e.message;
    }
  }

  function base64UrlDecode(str) {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    while (output.length % 4) {
      output += '=';
    }
    return decodeURIComponent(atob(output).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  }

  function auditHeaders() {
    const raw = headersInput.value.trim();
    auditContainer.innerHTML = '';

    if (!raw) {
      UI.showToast('Please paste HTTP response headers first', 'warning');
      return;
    }

    const lines = raw.split('\n');
    const headers = {};
    lines.forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        headers[parts[0].trim().toLowerCase()] = parts.slice(1).join(':').trim();
      }
    });

    const checks = [
      {
        name: 'Strict-Transport-Security (HSTS)',
        key: 'strict-transport-security',
        required: true,
        recommendation: 'Enforces HTTPS connections. Add: max-age=31536000; includeSubDomains'
      },
      {
        name: 'Content-Security-Policy (CSP)',
        key: 'content-security-policy',
        required: true,
        recommendation: 'Prevents XSS attacks. Define script-src, object-src directives.'
      },
      {
        name: 'X-Content-Type-Options',
        key: 'x-content-type-options',
        expected: 'nosniff',
        recommendation: 'Set to "nosniff" to prevent MIME-sniffing.'
      },
      {
        name: 'Access-Control-Allow-Origin (CORS)',
        key: 'access-control-allow-origin',
        validate: (val) => val !== '*',
        recommendation: 'Avoid wildcard "*". Specify trusted origins explicitly.'
      }
    ];

    checks.forEach(check => {
      const val = headers[check.key];
      const div = document.createElement('div');
      
      if (val) {
        let isPass = true;
        if (check.expected && val.toLowerCase() !== check.expected) isPass = false;
        if (check.validate && !check.validate(val)) isPass = false;

        if (isPass) {
          div.className = 'audit-item pass';
          div.innerHTML = `<strong>✓ ${check.name}:</strong> ${val}`;
        } else {
          div.className = 'audit-item warn';
          div.innerHTML = `<strong>⚠️ ${check.name}:</strong> Found "${val}". ${check.recommendation}`;
        }
      } else {
        div.className = 'audit-item warn';
        div.innerHTML = `<strong>❌ Missing ${check.name}:</strong> ${check.recommendation}`;
      }

      auditContainer.appendChild(div);
    });
  }

  return { init };
})();