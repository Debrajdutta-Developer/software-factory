/**
 * ContractPulse — Enterprise API Contract Studio & Intelligent Mock Engine
 * Complete Autonomous Client-Side Application
 */

(function () {
  'use me strict';

  // ==========================================
  // 1. DATA PRESETS & APPLICATION STATE
  // ==========================================

  const PRESET_SPECS = {
    payment: {
      name: "Stripe-like Payment API v2.1",
      version: "2.1.0",
      endpoints: [
        {
          id: "ep-1",
          method: "POST",
          path: "/api/v2/payments/charge",
          tag: "Payments",
          summary: "Authorize and charge payment source",
          description: "Processes credit card or digital wallet transaction securely. Validates schema payload and returns transaction token.",
          headers: [
            { name: "Authorization", required: true, example: "Bearer sk_test_9948271038" },
            { name: "Content-Type", required: true, example: "application/json" }
          ],
          requestPayload: {
            amount: 4999,
            currency: "USD",
            source: "tok_visa_debit_standard",
            description: "Enterprise Subscription - Monthly Tier",
            customer: {
              email: "dev.lead@acme-corp.io",
              metadata: { tenant_id: "tenant_9942_cx" }
            }
          },
          responsePayload: {
            id: "ch_3M09182KS9012A",
            object: "charge",
            amount: 4999,
            currency: "usd",
            status: "succeeded",
            captured: true,
            created: 1718000000,
            customer_email: "dev.lead@acme-corp.io",
            receipt_url: "https://pay.acme.io/receipts/ch_3M09182KS9012A"
          }
        },
        {
          id: "ep-2",
          method: "GET",
          path: "/api/v2/customers/{id}",
          tag: "Customers",
          summary: "Retrieve customer account profile",
          description: "Fetches metadata, active payment methods, and billing history for specified customer ID.",
          headers: [{ name: "Authorization", required: true, example: "Bearer sk_test_9948271038" }],
          requestPayload: null,
          responsePayload: {
            id: "cus_N78210923",
            object: "customer",
            email: "dev.lead@acme-corp.io",
            balance: 0,
            delinquent: false,
            created: 1715000000
          }
        },
        {
          id: "ep-3",
          method: "POST",
          path: "/api/v2/refunds",
          tag: "Payments",
          summary: "Initiate partial or full refund",
          description: "Reverses a previously succeeded charge token and emits payment.refunded event.",
          headers: [{ name: "Authorization", required: true, example: "Bearer sk_test_9948271038" }],
          requestPayload: {
            charge: "ch_3M09182KS9012A",
            amount: 1000,
            reason: "requested_by_customer"
          },
          responsePayload: {
            id: "re_8830129841",
            object: "refund",
            amount: 1000,
            status: "succeeded"
          }
        }
      ]
    },
    ecommerce: {
      name: "E-Commerce Order Fulfillment API v3.0",
      version: "3.0.0",
      endpoints: [
        {
          id: "ep-ec-1",
          method: "POST",
          path: "/api/v3/orders/checkout",
          tag: "Orders",
          summary: "Submit shopping cart checkout",
          description: "Validates inventory availability and generates pending order fulfillment.",
          headers: [{ name: "X-Store-Id", required: true, example: "store_us_west_1" }],
          requestPayload: {
            cart_id: "cart_992019",
            items: [{ sku: "SKU-NEON-KEYBOARD", quantity: 1, price: 149.99 }],
            shipping_address: { city: "San Francisco", zip: "94105" }
          },
          responsePayload: {
            order_id: "ord_7749210",
            status: "processing",
            total_amount: 149.99,
            estimated_delivery: "2025-06-15"
          }
        }
      ]
    },
    healthcare: {
      name: "FHIR Healthcare Patient Records API v1.0",
      version: "1.0.0",
      endpoints: [
        {
          id: "ep-hc-1",
          method: "GET",
          path: "/fhir/r4/Patient/{id}",
          tag: "Patients",
          summary: "Fetch FHIR Patient Demographics",
          description: "Retrieves HL7/FHIR formatted patient resource record.",
          headers: [{ name: "Accept", required: true, example: "application/fhir+json" }],
          requestPayload: null,
          responsePayload: {
            resourceType: "Patient",
            id: "p-90421",
            active: true,
            name: [{ family: "Shaw", given: ["Alexander"] }],
            gender: "male"
          }
        }
      ]
    }
  };

  // Global State
  const state = {
    activePresetKey: 'payment',
    currentSpec: PRESET_SPECS['payment'],
    selectedEndpointId: 'ep-1',
    mockSettings: {
      latencyEnabled: true,
      latencyMs: 120,
      chaosModeEnabled: false,
      statusOverride: 200
    },
    metrics: {
      totalRequests: 42,
      totalLatencySum: 4956
    },
    diffData: [
      {
        id: "diff-1",
        type: "breaking",
        icon: "🚨",
        title: "Required Parameter Added: `billing_address`",
        location: "POST /api/v2/payments/charge",
        description: "Field `billing_address` was changed from optional to required in OpenAPI schema payload definition.",
        remediation: "Frontend clients calling this endpoint without `billing_address` will receive status 400 Bad Request."
      },
      {
        id: "diff-2",
        type: "breaking",
        icon: "🚨",
        title: "Field Type Mutated: `amount` (string ➔ integer)",
        location: "POST /api/v2/refunds",
        description: "Field `amount` representation altered from String format formatted float to integer subunit cents.",
        remediation: "Ensure client dynamic serializer parses numbers as integers instead of string dollar values."
      },
      {
        id: "diff-3",
        type: "warning",
        icon: "⚠️",
        title: "Endpoint Deprecation Notice",
        location: "GET /api/v1/legacy/charge-history",
        description: "Endpoint marked as deprecated. Sunset date set for Q4 2025.",
        remediation: "Migrate client consumers to `GET /api/v2/customers/{id}/charges`."
      },
      {
        id: "diff-4",
        type: "addition",
        icon: "✨",
        title: "New Optional Response Field: `receipt_url`",
        location: "POST /api/v2/payments/charge",
        description: "Added field `receipt_url` to response status payload schema.",
        remediation: "Non-breaking. Safe to deploy without immediate client code changes."
      }
    ],
    sequenceSteps: [
      {
        id: 1,
        title: "Authenticate & Obtain Token",
        method: "POST",
        path: "/api/v2/auth/token",
        extractVar: "AUTH_TOKEN",
        jsonPointer: "access_token",
        status: "idle"
      },
      {
        id: 2,
        title: "Create Customer Account",
        method: "POST",
        path: "/api/v2/customers",
        extractVar: "CUSTOMER_ID",
        jsonPointer: "id",
        status: "idle"
      },
      {
        id: 3,
        title: "Authorize Charge with Context Token",
        method: "POST",
        path: "/api/v2/payments/charge",
        extractVar: "CHARGE_ID",
        jsonPointer: "id",
        status: "idle"
      }
    ],
    mockRules: [
      { id: "rule-1", endpoint: "POST /payments/charge", override: "200 OK Dynamic Payload", active: true },
      { id: "rule-2", endpoint: "GET /customers/*", override: "Inject Simulated Latency (+300ms)", active: true },
      { id: "rule-3", endpoint: "POST /refunds", override: "Schema Validation Guard", active: false }
    ]
  };

  // ==========================================
  // 2. CORE ENGINES (Mock Engine, Dynamic Generators & Diff Audit)
  // ==========================================

  // Dynamic Fake Data Generator
  function generateDynamicFakeData(template) {
    let raw = JSON.stringify(template);
    
    // Replace custom fake tags
    raw = raw.replace(/tok_visa_debit_standard/g, () => "tok_" + Math.random().toString(36).substring(2, 12));
    raw = raw.replace(/dev\.lead@acme-corp\.io/g, () => `dev.${Math.floor(Math.random()*1000)}@acme-corp.io`);
    raw = raw.replace(/idemp_seq_8839210/g, () => "idemp_" + Date.now());
    
    try {
      return JSON.parse(raw);
    } catch (e) {
      return template;
    }
  }

  // Synthetic Mock Server Engine
  function executeMockRequest(endpoint, requestBodyStr) {
    return new Promise((resolve) => {
      let delay = state.mockSettings.latencyEnabled ? parseInt(state.mockSettings.latencyMs, 10) : 10;
      // Add slight random jitter
      delay += Math.floor(Math.random() * 25);

      setTimeout(() => {
        state.metrics.totalRequests += 1;
        state.metrics.totalLatencySum += delay;

        let statusCode = state.mockSettings.statusOverride;
        let isChaos = state.mockSettings.chaosModeEnabled && Math.random() < 0.35;

        if (isChaos) {
          statusCode = Math.random() > 0.5 ? 500 : 429;
        }

        let responsePayload = {};
        let isValidSchema = true;

        if (statusCode >= 200 && statusCode < 300) {
          responsePayload = generateDynamicFakeData(endpoint.responsePayload || { status: "success" });
        } else if (statusCode === 400) {
          isValidSchema = false;
          responsePayload = {
            error: {
              code: "invalid_request_schema",
              message: "Payload missing required parameters: billing_address",
              param: "billing_address"
            }
          };
        } else if (statusCode === 429) {
          responsePayload = { error: { code: "rate_limit_exceeded", message: "Too many synthetic requests." } };
        } else {
          responsePayload = { error: { code: "internal_server_error", message: "Synthetic Chaos Injection Failed." } };
        }

        updateMetricUI();

        resolve({
          status: statusCode,
          statusText: statusCode === 200 ? "OK" : statusCode === 201 ? "Created" : "Error",
          latency: delay,
          payload: responsePayload,
          isValidSchema: isValidSchema
        });
      }, delay);
    });
  }

  // Updates top header and sidebar counters
  function updateMetricUI() {
    const reqEl = document.getElementById('metric-requests');
    const avgEl = document.getElementById('metric-avg-time');
    if (reqEl) reqEl.textContent = state.metrics.totalRequests;
    if (avgEl) {
      const avg = Math.round(state.metrics.totalLatencySum / state.metrics.totalRequests);
      avgEl.textContent = `${avg}ms`;
    }
  }

  // ==========================================
  // 3. UI CONTROLLER & EVENT HANDLERS
  // ==========================================

  function initUI() {
    bindNavigationTabs();
    bindHeaderControls();
    bindSandboxEvents();
    bindDiffEvents();
    bindSequenceEvents();
    bindMockRulesEvents();
    bindPresetModal();
    renderEndpointDirectory();
    renderActiveEndpointSandbox();
    renderDiffResults('all');
    renderSequenceSteps();
    renderMockRulesList();
    renderComplianceTable();
  }

  // Navigation Tab Switcher
  function bindNavigationTabs() {
    const navButtons = document.querySelectorAll('.nav-menu .nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-page').forEach(page => page.classList.remove('active'));
        const activePage = document.getElementById(targetTab);
        if (activePage) activePage.classList.add('active');
      });
    });

    // Sandbox sub-tabs
    const sbxTabs = document.querySelectorAll('.sbx-tab-btn');
    sbxTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        sbxTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetId = btn.getAttribute('data-sbx');
        document.querySelectorAll('.sandbox-tab-content').forEach(c => c.classList.remove('active'));
        const activeTab = document.getElementById(targetId);
        if (activeTab) activeTab.classList.add('active');
      });
    });
  }

  // Header Controls (Latency toggle, Chaos Mode, Presets, Export)
  function bindHeaderControls() {
    const toggleLatency = document.getElementById('toggle-latency');
    const toggleChaos = document.getElementById('toggle-chaos');
    const latencyVal = document.getElementById('latency-val');
    const sliderLatency = document.getElementById('slider-latency');
    const sliderText = document.getElementById('slider-latency-text');

    if (toggleLatency) {
      toggleLatency.addEventListener('change', (e) => {
        state.mockSettings.latencyEnabled = e.target.checked;
      });
    }

    if (toggleChaos) {
      toggleChaos.addEventListener('change', (e) => {
        state.mockSettings.chaosModeEnabled = e.target.checked;
      });
    }

    if (sliderLatency) {
      sliderLatency.addEventListener('input', (e) => {
        const val = e.target.value;
        state.mockSettings.latencyMs = val;
        if (latencyVal) latencyVal.textContent = `${val}ms`;
        if (sliderText) sliderText.textContent = `${val}ms`;
      });
    }

    // Modal Trigger
    const btnLoadSample = document.getElementById('btn-load-sample');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        document.getElementById('preset-modal').classList.add('active');
      });
    }

    // Export Button
    const btnExport = document.getElementById('btn-export-all');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `contractpulse-studio-${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    }
  }

  // Endpoint Directory Render
  function renderEndpointDirectory() {
    const treeContainer = document.getElementById('endpoint-tree-list');
    const countEl = document.getElementById('endpoint-count');
    if (!treeContainer) return;

    treeContainer.innerHTML = '';
    const endpoints = state.currentSpec.endpoints;
    if (countEl) countEl.textContent = `${endpoints.length} Endpoints`;

    // Group by tags
    const groups = {};
    endpoints.forEach(ep => {
      const tag = ep.tag || 'General';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(ep);
    });

    Object.keys(groups).forEach(tag => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'ep-tag-group';
      groupDiv.innerHTML = `<div class="ep-tag-title">${tag}</div>`;

      groups[tag].forEach(ep => {
        const item = document.createElement('div');
        item.className = `ep-item ${ep.id === state.selectedEndpointId ? 'active' : ''}`;
        item.innerHTML = `
          <span class="method-badge method-${ep.method.toLowerCase()}">${ep.method}</span>
          <span class="ep-path">${ep.path}</span>
        `;
        item.addEventListener('click', () => {
          state.selectedEndpointId = ep.id;
          renderEndpointDirectory();
          renderActiveEndpointSandbox();
        });
        groupDiv.appendChild(item);
      });

      treeContainer.appendChild(groupDiv);
    });
  }

  // Active Sandbox Inspector Render
  function renderActiveEndpointSandbox() {
    const ep = state.currentSpec.endpoints.find(e => e.id === state.selectedEndpointId) || state.currentSpec.endpoints[0];
    if (!ep) return;

    const methodEl = document.getElementById('sbx-method');
    const urlEl = document.getElementById('sbx-url');
    const descEl = document.getElementById('sbx-description');
    const bodyEditor = document.getElementById('sbx-request-json');
    const schemaTree = document.getElementById('sbx-schema-tree');

    if (methodEl) {
      methodEl.textContent = ep.method;
      methodEl.className = `method-tag tag-${ep.method.toLowerCase()}`;
    }
    if (urlEl) urlEl.value = ep.path;
    if (descEl) descEl.textContent = ep.description;

    if (bodyEditor) {
      bodyEditor.value = ep.requestPayload ? JSON.stringify(ep.requestPayload, null, 2) : '{\n  // Endpoint requires no request body\n}';
    }

    if (schemaTree) {
      schemaTree.innerHTML = `<pre>${JSON.stringify(generateJSONSchemaFromObject(ep.responsePayload || {}), null, 2)}</pre>`;
    }
  }

  // Simple Schema Inference Tool
  function generateJSONSchemaFromObject(obj) {
    if (obj === null) return { type: "null" };
    const type = Array.isArray(obj) ? "array" : typeof obj;
    if (type !== "object") return { type };

    const properties = {};
    Object.keys(obj).forEach(key => {
      properties[key] = generateJSONSchemaFromObject(obj[key]);
    });
    return {
      type: "object",
      required: Object.keys(obj),
      properties: properties
    };
  }

  // Sandbox Action Events
  function bindSandboxEvents() {
    const btnSend = document.getElementById('btn-send-request');
    const btnFormat = document.getElementById('btn-format-json');
    const btnDynamic = document.getElementById('btn-gen-dynamic');
    const bodyEditor = document.getElementById('sbx-request-json');

    if (btnSend) {
      btnSend.addEventListener('click', executeSandboxSend);
    }

    // Shortcut Ctrl+Enter
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        executeSandboxSend();
      }
    });

    if (btnFormat && bodyEditor) {
      btnFormat.addEventListener('click', () => {
        try {
          const formatted = JSON.stringify(JSON.parse(bodyEditor.value), null, 2);
          bodyEditor.value = formatted;
        } catch (err) {
          alert('Invalid JSON formatting: ' + err.message);
        }
      });
    }

    if (btnDynamic && bodyEditor) {
      btnDynamic.addEventListener('click', () => {
        try {
          const current = JSON.parse(bodyEditor.value);
          const generated = generateDynamicFakeData(current);
          bodyEditor.value = JSON.stringify(generated, null, 2);
        } catch (e) {
          alert('Parse error in JSON payload editor.');
        }
      });
    }
  }

  async function executeSandboxSend() {
    const ep = state.currentSpec.endpoints.find(e => e.id === state.selectedEndpointId);
    if (!ep) return;

    const btnSend = document.getElementById('btn-send-request');
    const resStatusCode = document.getElementById('res-status-code');
    const resTime = document.getElementById('res-time');
    const resSize = document.getElementById('res-size');
    const resContractStatus = document.getElementById('res-contract-status');
    const resJson = document.getElementById('sbx-response-json');
    const bodyEditor = document.getElementById('sbx-request-json');

    if (btnSend) btnSend.innerHTML = `<span>Executing Mock...</span>`;

    const res = await executeMockRequest(ep, bodyEditor ? bodyEditor.value : '');

    if (btnSend) btnSend.innerHTML = `<span>Send Request</span><kbd>Ctrl+Enter</kbd>`;

    if (resStatusCode) {
      resStatusCode.textContent = `${res.status} ${res.statusText}`;
      resStatusCode.className = `status-badge status-${res.status >= 200 && res.status < 300 ? '200' : res.status >= 400 && res.status < 500 ? '400' : '500'}`;
    }

    if (resTime) resTime.textContent = `${res.latency}ms`;
    const strRes = JSON.stringify(res.payload, null, 2);
    if (resSize) resSize.textContent = `${strRes.length} B`;
    if (resJson) resJson.textContent = strRes;

    if (resContractStatus) {
      if (res.isValidSchema) {
        resContractStatus.textContent = '✓ Schema Valid';
        resContractStatus.className = 'text-success';
      } else {
        resContractStatus.textContent = '✖ Contract Violation';
        resContractStatus.className = 'badge danger';
      }
    }

    // Switch to response preview tab automatically
    const respTabBtn = document.querySelector('[data-sbx="sbx-response"]');
    if (respTabBtn) respTabBtn.click();
  }

  // ==========================================
  // 4. SPEC DIFF AUDITOR ENGINE & RENDERING
  // ==========================================

  function bindDiffEvents() {
    const btnRunDiff = document.getElementById('btn-run-diff');
    const filterPills = document.querySelectorAll('.pill-filter');

    if (btnRunDiff) {
      btnRunDiff.addEventListener('click', () => {
        renderDiffResults('all');
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-filter');
        renderDiffResults(filter);
      });
    });
  }

  function renderDiffResults(filterType) {
    const listContainer = document.getElementById('diff-results-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const filtered = state.diffData.filter(item => {
      if (filterType === 'breaking') return item.type === 'breaking';
      if (filterType === 'additions') return item.type === 'addition';
      return true;
    });

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = `diff-item ${item.type}`;
      card.innerHTML = `
        <div class="diff-icon">${item.icon}</div>
        <div class="diff-content">
          <div class="diff-title">
            <span>${item.title}</span>
            <code>${item.location}</code>
          </div>
          <div class="diff-desc">${item.description}</div>
          <div class="diff-remediation"><strong>Remediation:</strong> ${item.remediation}</div>
        </div>
      `;
      listContainer.appendChild(card);
    });
  }

  // ==========================================
  // 5. WORKFLOW SEQUENCE SIMULATOR
  // ==========================================

  function bindSequenceEvents() {
    const btnRunSeq = document.getElementById('btn-run-sequence');
    const btnAddStep = document.getElementById('btn-add-step');
    const btnClearLogs = document.getElementById('btn-clear-logs');

    if (btnRunSeq) btnRunSeq.addEventListener('click', runSequencePipeline);
    if (btnAddStep) {
      btnAddStep.addEventListener('click', () => {
        const nextId = state.sequenceSteps.length + 1;
        state.sequenceSteps.push({
          id: nextId,
          title: `Custom Step ${nextId}`,
          method: "POST",
          path: "/api/v2/resources",
          extractVar: `RES_ID_${nextId}`,
          jsonPointer: "id",
          status: "idle"
        });
        renderSequenceSteps();
      });
    }

    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        const logOutput = document.getElementById('sequence-log-output');
        if (logOutput) logOutput.innerHTML = '<div class="log-line info">[System] Logs cleared.</div>';
      });
    }
  }

  function renderSequenceSteps() {
    const container = document.getElementById('sequence-steps-list');
    if (!container) return;

    container.innerHTML = '';
    state.sequenceSteps.forEach(step => {
      const stepEl = document.createElement('div');
      stepEl.className = 'step-card';
      stepEl.innerHTML = `
        <div class="step-header">
          <div class="step-title-group">
            <span class="step-number">${step.id}</span>
            <strong>${step.title}</strong>
            <span class="method-badge method-${step.method.toLowerCase()}">${step.method}</span>
            <code>${step.path}</code>
          </div>
          <span class="badge ${step.status === 'success' ? 'success' : step.status === 'running' ? 'warning' : ''}">${step.status.toUpperCase()}</span>
        </div>
        <div class="step-extract-box">
          Context Extractor: Extract <code>$.${step.jsonPointer}</code> into variable <code>{{${step.extractVar}}}</code>
        </div>
      `;
      container.appendChild(stepEl);
    });
  }

  async function runSequencePipeline() {
    const logOutput = document.getElementById('sequence-log-output');
    const contextStore = {};

    function log(msg, type = 'info') {
      if (!logOutput) return;
      const line = document.createElement('div');
      line.className = `log-line ${type}`;
      line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logOutput.appendChild(line);
      logOutput.scrollTop = logOutput.scrollHeight;
    }

    log("Starting multi-step pipeline execution...", "info");

    for (let i = 0; i < state.sequenceSteps.length; i++) {
      const step = state.sequenceSteps[i];
      step.status = 'running';
      renderSequenceSteps();

      log(`Executing Step ${step.id}: ${step.method} ${step.path}`, "info");

      // Inject prior variables if present
      let mockPayload = { timestamp: Date.now() };
      if (step.extractVar === "CHARGE_ID") {
        mockPayload.customer = contextStore['CUSTOMER_ID'] || "cus_fallback";
        mockPayload.auth_token = contextStore['AUTH_TOKEN'] || "token_fallback";
      }

      const response = await executeMockRequest({ method: step.method, path: step.path, responsePayload: mockPayload }, JSON.stringify(mockPayload));

      if (response.status >= 200 && response.status < 300) {
        step.status = 'success';
        const simulatedVal = `${step.extractVar.toLowerCase()}_val_${Math.floor(Math.random() * 89999 + 10000)}`;
        contextStore[step.extractVar] = simulatedVal;

        log(`Step ${step.id} Succeeded (${response.latency}ms). Extracted {{${step.extractVar}}} = "${simulatedVal}"`, "success");
      } else {
        step.status = 'error';
        log(`Step ${step.id} Failed with Status ${response.status}`, "warn");
        break;
      }
      renderSequenceSteps();
    }

    log("Pipeline Execution Sequence Completed.", "success");
  }

  // ==========================================
  // 6. MOCK RULES & COMPLIANCE TABLE
  // ==========================================

  function bindMockRulesEvents() {
    const statusSelect = document.getElementById('mock-status-override');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        state.mockSettings.statusOverride = parseInt(e.target.value, 10);
      });
    }
  }

  function renderMockRulesList() {
    const container = document.getElementById('mock-rules-list');
    if (!container) return;

    container.innerHTML = '';
    state.mockRules.forEach(rule => {
      const item = document.createElement('div');
      item.className = 'rule-item';
      item.innerHTML = `
        <div class="rule-item-info">
          <strong>${rule.endpoint}</strong>
          <span>Override Rule: ${rule.override}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${rule.active ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;
      container.appendChild(item);
    });
  }

  function renderComplianceTable() {
    const tbody = document.getElementById('compliance-results-body');
    const btnRunSuite = document.getElementById('btn-run-suite');
    if (!tbody) return;

    const testCases = [
      { name: "Schema Validation Guard", endpoint: "POST /payments/charge", standard: "OpenAPI 3.1", status: "PASS", score: "99ms" },
      { name: "Idempotency Header Check", endpoint: "POST /payments/charge", standard: "RFC 7231", status: "PASS", score: "104ms" },
      { name: "JWT Bearer Auth Header Verification", endpoint: "GET /customers/{id}", standard: "OAuth 2.0 / RFC 6750", status: "PASS", score: "42ms" },
      { name: "Content-Type application/json Guard", endpoint: "POST /refunds", standard: "REST standard", status: "PASS", score: "61ms" },
      { name: "Breaking Change Backward Compatibility", endpoint: "All endpoints", standard: "SemVer contract", status: "WARN", score: "118ms" }
    ];

    function fillTable() {
      tbody.innerHTML = '';
      testCases.forEach(tc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${tc.name}</strong></td>
          <td><code>${tc.endpoint}</code></td>
          <td>${tc.standard}</td>
          <td><span class="badge ${tc.status === 'PASS' ? 'success' : 'warning'}">${tc.status}</span></td>
          <td>${tc.score}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    fillTable();

    if (btnRunSuite) {
      btnRunSuite.addEventListener('click', () => {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Running Compliance Audit Suite...</td></tr>';
        setTimeout(fillTable, 600);
      });
    }
  }

  // ==========================================
  // 7. PRESET SPEC MODAL HANDLER
  // ==========================================

  function bindPresetModal() {
    const modal = document.getElementById('preset-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const presetCards = document.querySelectorAll('.preset-card');
    const nameLabel = document.getElementById('active-spec-name');

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => modal.classList.remove('active'));
    }

    presetCards.forEach(card => {
      card.addEventListener('click', () => {
        presetCards.forEach(c => c.classList.remove('active-preset'));
        card.classList.add('active-preset');

        const presetKey = card.getAttribute('data-preset');
        if (PRESET_SPECS[presetKey]) {
          state.activePresetKey = presetKey;
          state.currentSpec = PRESET_SPECS[presetKey];
          state.selectedEndpointId = state.currentSpec.endpoints[0].id;

          if (nameLabel) nameLabel.textContent = state.currentSpec.name;

          renderEndpointDirectory();
          renderActiveEndpointSandbox();
          if (modal) modal.classList.remove('active');
        }
      });
    });
  }

  // Initialize application on DOM ready
  document.addEventListener('DOMContentLoaded', initUI);

})();