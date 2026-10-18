(function() {
  // State
  let rawHarData = null;
  let sanitizedHarData = null;
  let analysisResults = [];
  let selectedIndex = null;

  // Sensitive patterns configuration
  const SENSITIVE_HEADERS = [
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'x-session-token',
    'token',
    'apikey',
    'secret'
  ];

  const SENSITIVE_QUERY_KEYS = [
    'access_token',
    'token',
    'auth',
    'api_key',
    'apikey',
    'secret',
    'key',
    'signature',
    'password',
    'session_id',
    'jwt'
  ];

  const SENSITIVE_BODY_KEYS = [
    'password',
    'passwd',
    'token',
    'access_token',
    'refresh_token',
    'client_secret',
    'secret',
    'card_number',
    'cvv',
    'ssn'
  ];

  // Regex token detectors
  const JWT_REGEX = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  const BEARER_REGEX = /Bearer\s+([A-Za-z0-9_\-\.~+/=]+)/gi;
  const AWS_KEY_REGEX = /(?:AKIA|ASIA)[0-9A-Z]{16}/g;

  // DOM Elements
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('empty-state');
  const requestsList = document.getElementById('requests-list');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnExportHar = document.getElementById('btn-export-har');
  const btnCopyCurl = document.getElementById('btn-copy-curl');
  const btnCopyJson = document.getElementById('btn-copy-json');
  const btnResetRules = document.getElementById('btn-reset-rules');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const detailEmptyMessage = document.getElementById('detail-empty-message');
  const detailContent = document.getElementById('detail-content');
  const toastEl = document.getElementById('toast');

  // Rule Inputs
  const ruleAuth = document.getElementById('rule-auth-headers');
  const ruleCookies = document.getElementById('rule-cookies');
  const ruleQuery = document.getElementById('rule-query-params');
  const ruleBody = document.getElementById('rule-body-payload');
  const ruleJwts = document.getElementById('rule-jwts');
  const selectRedactionMode = document.getElementById('redaction-mode');

  // Stats Elements
  const statRequests = document.getElementById('stat-requests');
  const statLeaks = document.getElementById('stat-leaks');
  const statAuth = document.getElementById('stat-auth');
  const statCookies = document.getElementById('stat-cookies');
  const statSanitized = document.getElementById('stat-sanitized');

  // Tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');

  // Init Event Listeners
  function init() {
    fileInput.addEventListener('change', handleFileUpload);
    btnLoadSample.addEventListener('click', loadSampleData);
    btnExportHar.addEventListener('click', exportCleanHar);
    btnCopyCurl.addEventListener('click', copyCleanCurl);
    btnCopyJson.addEventListener('click', copyCleanJson);
    btnResetRules.addEventListener('click', resetRules);

    searchInput.addEventListener('input', renderRequestsList);
    statusFilter.addEventListener('change', renderRequestsList);

    [ruleAuth, ruleCookies, ruleQuery, ruleBody, ruleJwts, selectRedactionMode].forEach(el => {
      el.addEventListener('change', reprocessHar);
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });
    dropZone.addEventListener('drop', e => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        parseFile(e.dataTransfer.files[0]);
      }
    });

    // Tabs
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
      });
    });
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  function resetRules() {
    ruleAuth.checked = true;
    ruleCookies.checked = true;
    ruleQuery.checked = true;
    ruleBody.checked = true;
    ruleJwts.checked = true;
    selectRedactionMode.value = 'mask';
    reprocessHar();
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) parseFile(file);
  }

  function parseFile(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!parsed.log || !Array.isArray(parsed.log.entries)) {
          alert('Invalid HAR structure: expected a root object with "log.entries" array.');
          return;
        }
        rawHarData = parsed;
        reprocessHar();
        showToast(`Loaded ${parsed.log.entries.length} requests from ${file.name}`);
      } catch (err) {
        alert('Failed to parse HAR JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Utility to hash value for pseudonymization
  function pseudoHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `hash_${hex}`;
  }

  function getMask(type, origValue) {
    const mode = selectRedactionMode.value;
    if (mode === 'remove') return null;
    if (mode === 'pseudonym') return pseudoHash(origValue);
    return `[REDACTED_${type.toUpperCase()}]`;
  }

  // Deep sanitization routine
  function reprocessHar() {
    if (!rawHarData) return;

    const opts = {
      redactAuth: ruleAuth.checked,
      redactCookies: ruleCookies.checked,
      redactQuery: ruleQuery.checked,
      redactBody: ruleBody.checked,
      redactJwts: ruleJwts.checked,
      mode: selectRedactionMode.value
    };

    // Clone raw
    const clean = JSON.parse(JSON.stringify(rawHarData));
    analysisResults = [];

    let countLeaks = 0;
    let countAuth = 0;
    let countCookies = 0;
    let countSanitized = 0;

    clean.log.entries.forEach((entry, idx) => {
      const rawEntry = rawHarData.log.entries[idx];
      const reqReport = {
        index: idx,
        method: entry.request.method,
        url: entry.request.url,
        status: entry.response ? entry.response.status : 0,
        leaksFound: 0,
        authLeaks: 0,
        cookieLeaks: 0,
        headers: [],
        query: [],
        cookies: [],
        responseHeaders: [],
        postDataOriginal: rawEntry.request.postData ? rawEntry.request.postData.text : '',
        postDataSanitized: ''
      };

      // 1. Request Headers
      const cleanHeaders = [];
      (rawEntry.request.headers || []).forEach(h => {
        const nameLower = h.name.toLowerCase();
        let isSensitive = false;
        let category = 'safe';

        if (opts.redactAuth && SENSITIVE_HEADERS.includes(nameLower)) {
          isSensitive = true;
          category = 'auth';
          reqReport.authLeaks++;
        } else if (opts.redactCookies && (nameLower === 'cookie' || nameLower === 'set-cookie')) {
          isSensitive = true;
          category = 'cookie';
          reqReport.cookieLeaks++;
        } else if (opts.redactJwts && (JWT_REGEX.test(h.value) || AWS_KEY_REGEX.test(h.value))) {
          isSensitive = true;
          category = 'token';
          reqReport.authLeaks++;
        }

        let finalVal = h.value;
        if (isSensitive) {
          reqReport.leaksFound++;
          countLeaks++;
          countSanitized++;
          finalVal = getMask(category, h.value);
        }

        reqReport.headers.push({
          name: h.name,
          original: h.value,
          sanitized: finalVal,
          isSensitive,
          category
        });

        if (finalVal !== null) {
          cleanHeaders.push({ name: h.name, value: finalVal });
        }
      });
      entry.request.headers = cleanHeaders;

      // 2. Query Parameters
      const cleanQuery = [];
      (rawEntry.request.queryString || []).forEach(q => {
        const nameLower = q.name.toLowerCase();
        let isSensitive = false;
        if (opts.redactQuery && SENSITIVE_QUERY_KEYS.includes(nameLower)) {
          isSensitive = true;
        } else if (opts.redactJwts && JWT_REGEX.test(q.value)) {
          isSensitive = true;
        }

        let finalVal = q.value;
        if (isSensitive) {
          reqReport.leaksFound++;
          reqReport.authLeaks++;
          countLeaks++;
          countSanitized++;
          finalVal = getMask('PARAM', q.value);
        }

        reqReport.query.push({
          name: q.name,
          original: q.value,
          sanitized: finalVal,
          isSensitive
        });

        if (finalVal !== null) {
          cleanQuery.push({ name: q.name, value: finalVal });
        }
      });
      entry.request.queryString = cleanQuery;

      // Update Request URL if query was sanitized
      if (opts.redactQuery || opts.redactJwts) {
        try {
          const urlObj = new URL(entry.request.url);
          let urlChanged = false;
          urlObj.searchParams.forEach((val, k) => {
            const kLower = k.toLowerCase();
            if (opts.redactQuery && SENSITIVE_QUERY_KEYS.includes(kLower)) {
              const m = getMask('PARAM', val);
              if (m === null) urlObj.searchParams.delete(k);
              else urlObj.searchParams.set(k, m);
              urlChanged = true;
            }
          });
          if (urlChanged) {
            entry.request.url = urlObj.toString();
          }
        } catch (_) {
          // Invalid absolute URL, skip URL obj update
        }
      }

      // 3. Cookies Array
      const cleanCookies = [];
      (rawEntry.request.cookies || []).forEach(c => {
        let isSensitive = opts.redactCookies;
        let finalVal = c.value;
        if (isSensitive) {
          reqReport.leaksFound++;
          reqReport.cookieLeaks++;
          countLeaks++;
          countSanitized++;
          finalVal = getMask('COOKIE', c.value);
        }

        reqReport.cookies.push({
          name: c.name,
          original: c.value,
          sanitized: finalVal,
          isSensitive
        });

        if (finalVal !== null) {
          cleanCookies.push({ ...c, value: finalVal });
        }
      });
      entry.request.cookies = cleanCookies;

      // 4. Request Post Data Body
      if (rawEntry.request.postData && rawEntry.request.postData.text) {
        let bodyStr = rawEntry.request.postData.text;
        let wasSanitized = false;

        // Try parsing JSON
        if (opts.redactBody) {
          try {
            const bodyObj = JSON.parse(bodyStr);
            function sanitizeObj(obj) {
              for (let k in obj) {
                if (typeof obj[k] === 'object' && obj[k] !== null) {
                  sanitizeObj(obj[k]);
                } else if (SENSITIVE_BODY_KEYS.includes(k.toLowerCase())) {
                  obj[k] = getMask('FIELD', String(obj[k]));
                  wasSanitized = true;
                  countLeaks++;
                  countSanitized++;
                }
              }
            }
            sanitizeObj(bodyObj);
            if (wasSanitized) {
              bodyStr = JSON.stringify(bodyObj, null, 2);
              reqReport.leaksFound++;
            }
          } catch (_) {
            // Plaintext fallback string replace
            if (opts.redactJwts) {
              bodyStr = bodyStr.replace(JWT_REGEX, '[REDACTED_JWT]');
              bodyStr = bodyStr.replace(AWS_KEY_REGEX, '[REDACTED_AWS]');
            }
          }
        }

        if (entry.request.postData) {
          entry.request.postData.text = bodyStr;
        }
        reqReport.postDataSanitized = bodyStr;
      }

      // 5. Response Headers
      const cleanRespHeaders = [];
      if (entry.response && rawEntry.response.headers) {
        rawEntry.response.headers.forEach(h => {
          const nameLower = h.name.toLowerCase();
          let isSensitive = false;
          let category = 'safe';
          if (opts.redactCookies && (nameLower === 'set-cookie' || nameLower === 'cookie')) {
            isSensitive = true;
            category = 'cookie';
            reqReport.cookieLeaks++;
          } else if (opts.redactAuth && SENSITIVE_HEADERS.includes(nameLower)) {
            isSensitive = true;
            category = 'auth';
            reqReport.authLeaks++;
          }

          let finalVal = h.value;
          if (isSensitive) {
            reqReport.leaksFound++;
            countLeaks++;
            countSanitized++;
            finalVal = getMask(category, h.value);
          }

          reqReport.responseHeaders.push({
            name: h.name,
            original: h.value,
            sanitized: finalVal,
            isSensitive,
            category
          });

          if (finalVal !== null) {
            cleanRespHeaders.push({ name: h.name, value: finalVal });
          }
        });
        entry.response.headers = cleanRespHeaders;
      }

      countAuth += reqReport.authLeaks;
      countCookies += reqReport.cookieLeaks;
      analysisResults.push(reqReport);
    });

    sanitizedHarData = clean;

    // Update Stats Strip
    statRequests.textContent = clean.log.entries.length;
    statLeaks.textContent = countLeaks;
    statAuth.textContent = countAuth;
    statCookies.textContent = countCookies;
    statSanitized.textContent = countSanitized;

    btnExportHar.disabled = false;
    dropZone.style.display = 'none';

    renderRequestsList();
    if (selectedIndex !== null && analysisResults[selectedIndex]) {
      renderDetail(selectedIndex);
    } else if (analysisResults.length > 0) {
      selectRequest(0);
    }
  }

  function renderRequestsList() {
    requestsList.innerHTML = '';
    const query = searchInput.value.toLowerCase().trim();
    const statusVal = statusFilter.value;

    analysisResults.forEach((item, index) => {
      // Filters
      if (query && !item.url.toLowerCase().includes(query) && !item.method.toLowerCase().includes(query)) {
        return;
      }
      if (statusVal === 'leaks' && item.leaksFound === 0) return;
      if (statusVal === '2xx' && (item.status < 200 || item.status >= 300)) return;
      if (statusVal === '4xx' && (item.status < 400 || item.status >= 500)) return;
      if (statusVal === '5xx' && (item.status < 500 || item.status >= 600)) return;

      const el = document.createElement('div');
      el.className = `request-item ${selectedIndex === index ? 'active' : ''}`;
      el.addEventListener('click', () => selectRequest(index));

      const statusClass = item.status >= 500 ? 's-5xx' : item.status >= 400 ? 's-4xx' : 's-2xx';

      el.innerHTML = `
        <div class="request-item-top">
          <div class="request-meta">
            <span class="badge-method method-${item.method}">${item.method}</span>
            <span class="badge-status ${statusClass}">${item.status || '-'}</span>
          </div>
          ${item.leaksFound > 0 ? `<span class="badge-leak-count">${item.leaksFound} leak${item.leaksFound > 1 ? 's' : ''}</span>` : '<span class="badge-status s-2xx">Clean</span>'}
        </div>
        <div class="request-url-line" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
      `;
      requestsList.appendChild(el);
    });
  }

  function selectRequest(idx) {
    selectedIndex = idx;
    const items = requestsList.querySelectorAll('.request-item');
    items.forEach((item, i) => {
      item.classList.remove('active');
    });
    renderRequestsList();
    renderDetail(idx);
  }

  function renderDetail(idx) {
    const item = analysisResults[idx];
    if (!item) return;

    detailEmptyMessage.style.display = 'none';
    detailContent.style.display = 'flex';

    const methodEl = document.getElementById('detail-method');
    methodEl.textContent = item.method;
    methodEl.className = `badge-method method-${item.method}`;
    document.getElementById('detail-url').textContent = item.url;

    // Populate Headers Table
    const tbodyHeaders = document.querySelector('#table-headers tbody');
    tbodyHeaders.innerHTML = '';
    if (item.headers.length === 0) {
      tbodyHeaders.innerHTML = '<tr><td colspan="4" style="color: #64748b;">No request headers found</td></tr>';
    } else {
      item.headers.forEach(h => {
        const tr = document.createElement('tr');
        let statusBadge = '<span class="tag-safe">Clean</span>';
        if (h.isSensitive) {
          statusBadge = h.sanitized === null ? '<span class="tag-stripped">Stripped</span>' : '<span class="tag-leak">Sanitized</span>';
        }
        tr.innerHTML = `
          <td><strong>${escapeHtml(h.name)}</strong></td>
          <td>${h.isSensitive ? `<span class="val-original-sensitive">${escapeHtml(h.original)}</span>` : escapeHtml(h.original)}</td>
          <td><span class="val-redacted">${h.sanitized === null ? '<em>[Header Removed]</em>' : escapeHtml(h.sanitized)}</span></td>
          <td>${statusBadge}</td>
        `;
        tbodyHeaders.appendChild(tr);
      });
    }

    // Populate Query Table
    const tbodyQuery = document.querySelector('#table-query tbody');
    tbodyQuery.innerHTML = '';
    if (item.query.length === 0) {
      tbodyQuery.innerHTML = '<tr><td colspan="4" style="color: #64748b;">No query parameters</td></tr>';
    } else {
      item.query.forEach(q => {
        const tr = document.createElement('tr');
        const statusBadge = q.isSensitive ? '<span class="tag-leak">Sanitized</span>' : '<span class="tag-safe">Clean</span>';
        tr.innerHTML = `
          <td><strong>${escapeHtml(q.name)}</strong></td>
          <td>${q.isSensitive ? `<span class="val-original-sensitive">${escapeHtml(q.original)}</span>` : escapeHtml(q.original)}</td>
          <td><span class="val-redacted">${escapeHtml(q.sanitized || '')}</span></td>
          <td>${statusBadge}</td>
        `;
        tbodyQuery.appendChild(tr);
      });
    }

    // Populate Cookies Table
    const tbodyCookies = document.querySelector('#table-cookies tbody');
    tbodyCookies.innerHTML = '';
    if (item.cookies.length === 0) {
      tbodyCookies.innerHTML = '<tr><td colspan="4" style="color: #64748b;">No cookies in request</td></tr>';
    } else {
      item.cookies.forEach(c => {
        const tr = document.createElement('tr');
        const statusBadge = c.isSensitive ? '<span class="tag-leak">Sanitized</span>' : '<span class="tag-safe">Clean</span>';
        tr.innerHTML = `
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${c.isSensitive ? `<span class="val-original-sensitive">${escapeHtml(c.original)}</span>` : escapeHtml(c.original)}</td>
          <td><span class="val-redacted">${escapeHtml(c.sanitized || '')}</span></td>
          <td>${statusBadge}</td>
        `;
        tbodyCookies.appendChild(tr);
      });
    }

    // Populate Post Body Diff
    const bodyOrig = document.getElementById('body-original');
    const bodySani = document.getElementById('body-sanitized');
    bodyOrig.textContent = item.postDataOriginal || '(Empty or not present)';
    bodySani.textContent = item.postDataSanitized || '(Empty or not present)';

    // Populate Response Headers Table
    const tbodyResp = document.querySelector('#table-response tbody');
    tbodyResp.innerHTML = '';
    if (item.responseHeaders.length === 0) {
      tbodyResp.innerHTML = '<tr><td colspan="4" style="color: #64748b;">No response headers</td></tr>';
    } else {
      item.responseHeaders.forEach(rh => {
        const tr = document.createElement('tr');
        const statusBadge = rh.isSensitive ? '<span class="tag-leak">Sanitized</span>' : '<span class="tag-safe">Clean</span>';
        tr.innerHTML = `
          <td><strong>${escapeHtml(rh.name)}</strong></td>
          <td>${rh.isSensitive ? `<span class="val-original-sensitive">${escapeHtml(rh.original)}</span>` : escapeHtml(rh.original)}</td>
          <td><span class="val-redacted">${escapeHtml(rh.sanitized || '')}</span></td>
          <td>${statusBadge}</td>
        `;
        tbodyResp.appendChild(tr);
      });
    }
  }

  // Export Download clean HAR
  function exportCleanHar() {
    if (!sanitizedHarData) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sanitizedHarData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'sanitized_log.har');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Clean sanitized .har file exported!');
  }

  // Copy sanitized cURL command
  function copyCleanCurl() {
    if (selectedIndex === null || !sanitizedHarData) return;
    const entry = sanitizedHarData.log.entries[selectedIndex];
    if (!entry) return;

    let curl = `curl -X ${entry.request.method} '${entry.request.url}'`;
    (entry.request.headers || []).forEach(h => {
      curl += ` \
  -H '${h.name}: ${h.value}'`;
    });
    if (entry.request.postData && entry.request.postData.text) {
      const escapedBody = entry.request.postData.text.replace(/'/g, "'\\''");
      curl += ` \
  --data-raw '${escapedBody}'`;
    }

    navigator.clipboard.writeText(curl).then(() => {
      showToast('Sanitized cURL command copied to clipboard!');
    }).catch(() => {
      prompt('Copy this cURL command:', curl);
    });
  }

  function copyCleanJson() {
    if (selectedIndex === null || !sanitizedHarData) return;
    const entry = sanitizedHarData.log.entries[selectedIndex];
    const str = JSON.stringify(entry, null, 2);
    navigator.clipboard.writeText(str).then(() => {
      showToast('Clean entry JSON copied to clipboard!');
    });
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Built-in synthetic sample HAR for instant testability
  function loadSampleData() {
    const sample = {
      log: {
        version: "1.2",
        creator: { name: "HAR Sanitizer Demo", version: "1.0" },
        entries: [
          {
            request: {
              method: "POST",
              url: "https://api.acme-corp.com/v1/auth/login?client_id=web_app&auth_prompt=true",
              headers: [
                { name: "Host", value: "api.acme-corp.com" },
                { name: "Content-Type", value: "application/json" },
                { name: "User-Agent", value: "Mozilla/5.0 Chrome/120.0.0.0" },
                { name: "X-Api-Key", value: "live_sec_9938472910482019485720" }
              ],
              queryString: [
                { name: "client_id", value: "web_app" },
                { name: "auth_prompt", value: "true" }
              ],
              cookies: [],
              postData: {
                mimeType: "application/json",
                text: JSON.stringify({
                  username: "admin@acme-corp.com",
                  password: "SuperSecretP@ssw0rd!",
                  client_secret: "cs_live_9482759104829304"
                }, null, 2)
              }
            },
            response: {
              status: 200,
              headers: [
                { name: "Content-Type", value: "application/json" },
                { name: "Set-Cookie", value: "session_id=sess_948174a9b82c7; Path=/; Secure; HttpOnly" },
                { name: "X-RateLimit-Remaining", value: "98" }
              ]
            }
          },
          {
            request: {
              method: "GET",
              url: "https://api.acme-corp.com/v1/users/me/profile?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIn0.doNotLeakThisSignature",
              headers: [
                { name: "Host", value: "api.acme-corp.com" },
                { name: "Authorization", value: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbiJ9.secretSignatureValue123" },
                { name: "Cookie", value: "session_id=sess_948174a9b82c7; tracking_consent=true" }
              ],
              queryString: [
                { name: "token", value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIn0.doNotLeakThisSignature" }
              ],
              cookies: [
                { name: "session_id", value: "sess_948174a9b82c7" },
                { name: "tracking_consent", value: "true" }
              ]
            },
            response: {
              status: 200,
              headers: [
                { name: "Content-Type", value: "application/json" },
                { name: "Cache-Control", value: "no-store" }
              ]
            }
          },
          {
            request: {
              method: "GET",
              url: "https://cdn.acme-corp.com/assets/logo.svg",
              headers: [
                { name: "Host", value: "cdn.acme-corp.com" },
                { name: "Accept", value: "image/svg+xml" }
              ],
              queryString: [],
              cookies: []
            },
            response: {
              status: 304,
              headers: [
                { name: "ETag", value: '"abc1234"' }
              ]
            }
          }
        ]
      }
    };

    rawHarData = sample;
    reprocessHar();
    showToast('Loaded sample HAR archive with 3 requests!');
  }

  // Bootstrap
  init();
})();
