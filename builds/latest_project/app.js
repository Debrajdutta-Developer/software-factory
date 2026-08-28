/**
 * CloudCraft Studio - Main Application Engine
 * Pure Client-Side Architecture Visualizer, Cost Calculator, Security Auditor & IaC Synthesizer
 */

// STATE MANAGEMENT
const state = {
  nodes: [],
  connections: [],
  selectedNodeId: null,
  isConnecting: false,
  connectingSourceId: null,
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  gridSnap: true,
  template: 'three-tier',
  auditFindings: [],
  totalMonthlyCost: 0,
  securityScore: 100,
  slaAvailability: 99.95
};

// COMPONENT DEFINITIONS & COST MATRIX
const COMPONENT_SPECS = {
  ec2: {
    name: 'Virtual Machine',
    category: 'compute',
    badge: 'VM',
    basePrice: 30.40, // t3.medium
    sla: 99.99,
    iacType: 'aws_instance'
  },
  lambda: {
    name: 'Serverless Function',
    category: 'compute',
    badge: 'λ',
    basePrice: 5.00,
    sla: 99.95,
    iacType: 'aws_lambda_function'
  },
  eks: {
    name: 'Kubernetes Cluster',
    category: 'compute',
    badge: 'K8s',
    basePrice: 144.00,
    sla: 99.95,
    iacType: 'aws_eks_cluster'
  },
  alb: {
    name: 'Load Balancer',
    category: 'network',
    badge: 'ALB',
    basePrice: 22.50,
    sla: 99.99,
    iacType: 'aws_lb'
  },
  cloudfront: {
    name: 'CDN Edge Network',
    category: 'network',
    badge: 'CDN',
    basePrice: 15.00,
    sla: 99.9,
    iacType: 'aws_cloudfront_distribution'
  },
  apigateway: {
    name: 'API Gateway',
    category: 'network',
    badge: 'API',
    basePrice: 10.00,
    sla: 99.95,
    iacType: 'aws_apigatewayv2_api'
  },
  waf: {
    name: 'Web App Firewall',
    category: 'security',
    badge: 'WAF',
    basePrice: 20.00,
    sla: 99.99,
    iacType: 'aws_wafv2_web_acl'
  },
  rds: {
    name: 'Managed Relational DB',
    category: 'db',
    badge: 'SQL',
    basePrice: 45.00,
    sla: 99.95,
    iacType: 'aws_db_instance'
  },
  dynamodb: {
    name: 'NoSQL Database',
    category: 'db',
    badge: 'NoSQL',
    basePrice: 12.00,
    sla: 99.99,
    iacType: 'aws_dynamodb_table'
  },
  s3: {
    name: 'Object Storage',
    category: 'storage',
    badge: 'S3',
    basePrice: 8.00,
    sla: 99.9,
    iacType: 'aws_s3_bucket'
  },
  redis: {
    name: 'In-Memory Cache',
    category: 'db',
    badge: 'Cache',
    basePrice: 25.00,
    sla: 99.9,
    iacType: 'aws_elasticache_cluster'
  }
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initDOMListeners();
  loadPresetTemplate('three-tier');
  renderCanvas();
});

// DOM EVENT LISTENERS
function initDOMListeners() {
  // Navigation & Toolbar
  document.getElementById('templateSelect').addEventListener('change', (e) => {
    loadPresetTemplate(e.target.value);
  });

  document.getElementById('btnClearCanvas').addEventListener('click', () => {
    state.nodes = [];
    state.connections = [];
    state.selectedNodeId = null;
    updateWorkspace();
  });

  document.getElementById('btnToggleGrid').addEventListener('click', (e) => {
    state.gridSnap = !state.gridSnap;
    e.target.innerText = `Grid Snap: ${state.gridSnap ? 'ON' : 'OFF'}`;
    e.target.classList.toggle('active', state.gridSnap);
  });

  document.getElementById('btnAutoLayout').addEventListener('click', autoLayoutNodes);

  document.getElementById('btnZoomIn').addEventListener('click', () => adjustZoom(0.1));
  document.getElementById('btnZoomOut').addEventListener('click', () => adjustZoom(-0.1));
  document.getElementById('btnResetView').addEventListener('click', resetView);

  // Inspector Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const tabId = e.target.getAttribute('data-tab');
      e.target.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  // Drag and Drop from Palette
  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('type', item.getAttribute('data-type'));
    });

    item.addEventListener('click', () => {
      const type = item.getAttribute('data-type');
      spawnNode(type, 150 + Math.random() * 80, 150 + Math.random() * 80);
    });
  });

  const canvasContainer = document.getElementById('canvas-container');
  canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
  canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (!type) return;

    const rect = canvasContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.pan.x) / state.zoom;
    const y = (e.clientY - rect.top - state.pan.y) / state.zoom;
    spawnNode(type, x, y);
  });

  // Property Inputs Wiring
  document.getElementById('nodeLabel').addEventListener('input', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.label = e.target.value;
      updateWorkspace();
    }
  });

  document.getElementById('propInstanceType').addEventListener('change', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.instanceType = e.target.value;
      updateWorkspace();
    }
  });

  document.getElementById('propInstanceCount').addEventListener('input', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.instanceCount = parseInt(e.target.value, 10);
      document.getElementById('valInstanceCount').innerText = node.props.instanceCount;
      updateWorkspace();
    }
  });

  document.getElementById('propStorageGb').addEventListener('input', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.storageGb = parseInt(e.target.value, 10);
      document.getElementById('valStorageGb').innerText = node.props.storageGb;
      updateWorkspace();
    }
  });

  document.getElementById('propRequestsPerSec').addEventListener('input', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.requestsPerSec = parseInt(e.target.value, 10);
      document.getElementById('valRequestsPerSec').innerText = node.props.requestsPerSec;
      updateWorkspace();
    }
  });

  document.getElementById('propPublicAccess').addEventListener('change', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.publicAccess = e.target.checked;
      updateWorkspace();
    }
  });

  document.getElementById('propMultiAz').addEventListener('change', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.multiAz = e.target.checked;
      updateWorkspace();
    }
  });

  document.getElementById('propEncryption').addEventListener('change', (e) => {
    const node = getSelectedNode();
    if (node) {
      node.props.encryption = e.target.checked;
      updateWorkspace();
    }
  });

  document.getElementById('btnDeleteNode').addEventListener('click', () => {
    if (state.selectedNodeId) {
      deleteNode(state.selectedNodeId);
    }
  });

  document.getElementById('btnAutoFixAll').addEventListener('click', autoFixAllRisks);

  // Export Buttons
  document.getElementById('btnExportTf').addEventListener('click', showExportModal);
  document.getElementById('btnCopyTf').addEventListener('click', copyTfCode);
  document.getElementById('btnExportJson').addEventListener('click', downloadArchitectureJson);
  
  // Modal Handlers
  document.getElementById('btnCloseModal').addEventListener('click', hideExportModal);
  document.getElementById('btnCloseModalBtn').addEventListener('click', hideExportModal);
  document.getElementById('btnDownloadTfFile').addEventListener('click', downloadTfFile);
}

// ARCHITECTURE TEMPLATE PRESETS
function loadPresetTemplate(templateId) {
  state.nodes = [];
  state.connections = [];
  state.selectedNodeId = null;

  if (templateId === 'three-tier') {
    const cdn = spawnNode('cloudfront', 80, 180, 'Global CDN');
    const waf = spawnNode('waf', 260, 180, 'Edge WAF');
    const alb = spawnNode('alb', 440, 180, 'Public ALB');
    const vm = spawnNode('ec2', 620, 180, 'Web App Cluster');
    const rds = spawnNode('rds', 800, 120, 'Postgres Primary');
    const cache = spawnNode('redis', 800, 260, 'ElastiCache Redis');

    rds.props.publicAccess = false;
    rds.props.multiAz = true;
    rds.props.encryption = true;

    connectNodes(cdn.id, waf.id);
    connectNodes(waf.id, alb.id);
    connectNodes(alb.id, vm.id);
    connectNodes(vm.id, rds.id);
    connectNodes(vm.id, cache.id);
  } else if (templateId === 'serverless') {
    const cdn = spawnNode('cloudfront', 100, 180, 'CloudFront Edge');
    const api = spawnNode('apigateway', 300, 180, 'API Gateway');
    const fn1 = spawnNode('lambda', 500, 100, 'Auth Function');
    const fn2 = spawnNode('lambda', 500, 260, 'Order Processor');
    const db = spawnNode('dynamodb', 720, 260, 'Orders DynamoDB');
    const s3 = spawnNode('s3', 720, 100, 'Static Assets S3');

    connectNodes(cdn.id, api.id);
    connectNodes(api.id, fn1.id);
    connectNodes(api.id, fn2.id);
    connectNodes(fn2.id, db.id);
    connectNodes(fn1.id, s3.id);
  } else if (templateId === 'kubernetes') {
    const waf = spawnNode('waf', 100, 180, 'Ingress WAF');
    const alb = spawnNode('alb', 280, 180, 'Kubernetes Ingress');
    const eks = spawnNode('eks', 480, 180, 'EKS Microservices');
    const rds = spawnNode('rds', 700, 120, 'RDS Aurora DB');
    const s3 = spawnNode('s3', 700, 260, 'App Storage');

    rds.props.publicAccess = true; // Intentional initial risk for auditor demo

    connectNodes(waf.id, alb.id);
    connectNodes(alb.id, eks.id);
    connectNodes(eks.id, rds.id);
    connectNodes(eks.id, s3.id);
  } else if (templateId === 'datalake') {
    const s3 = spawnNode('s3', 120, 180, 'Raw Data Ingestion');
    const fn = spawnNode('lambda', 320, 180, 'ETL Ingestion Handler');
    const rds = spawnNode('rds', 520, 180, 'Analytics Warehouse');

    s3.props.encryption = false; // Intentional risk

    connectNodes(s3.id, fn.id);
    connectNodes(fn.id, rds.id);
  }

  updateWorkspace();
}

// CANVAS NODE SPAWNING & MANAGEMENT
function spawnNode(type, x, y, customLabel = null) {
  const spec = COMPONENT_SPECS[type];
  if (!spec) return null;

  const id = 'node_' + Math.random().toString(36).substr(2, 9);
  const node = {
    id,
    type,
    label: customLabel || spec.name,
    x: state.gridSnap ? Math.round(x / 20) * 20 : x,
    y: state.gridSnap ? Math.round(y / 20) * 20 : y,
    props: {
      instanceType: 't3.medium',
      instanceCount: 2,
      storageGb: 100,
      requestsPerSec: 500,
      publicAccess: type === 'alb' || type === 'cloudfront' || type === 'apigateway' || type === 'waf',
      multiAz: true,
      encryption: true
    }
  };

  state.nodes.push(node);
  state.selectedNodeId = node.id;
  updateWorkspace();
  return node;
}

function deleteNode(nodeId) {
  state.nodes = state.nodes.filter(n => n.id !== nodeId);
  state.connections = state.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
  if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
  updateWorkspace();
}

function connectNodes(fromId, toId) {
  if (fromId === toId) return;
  const exists = state.connections.some(c => c.from === fromId && c.to === toId);
  if (!exists) {
    state.connections.push({ id: 'conn_' + Math.random().toString(36).substr(2, 9), from: fromId, to: toId });
  }
}

function getSelectedNode() {
  return state.nodes.find(n => n.id === state.selectedNodeId) || null;
}

// RENDERING ENGINE
function updateWorkspace() {
  runSecurityAudit();
  calculateCosts();
  calculateSla();
  renderCanvas();
  renderInspector();
  renderIaC();
}

function renderCanvas() {
  const nodesContainer = document.getElementById('canvas-nodes-layer');
  const svgConnections = document.getElementById('svg-connections-layer');
  
  nodesContainer.innerHTML = '';
  svgConnections.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
      </marker>
      <marker id="arrow-error" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
      </marker>
    </defs>
  `;

  // Render Connections (Wires)
  state.connections.forEach(conn => {
    const fromNode = state.nodes.find(n => n.id === conn.from);
    const toNode = state.nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return;

    const x1 = fromNode.x + 200; // right edge of source
    const y1 = fromNode.y + 40;
    const x2 = toNode.x; // left edge of target
    const y2 = toNode.y + 40;

    const dx = Math.abs(x2 - x1) * 0.5;
    const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    const hasRisk = state.auditFindings.some(f => f.nodeId === toNode.id && f.severity === 'danger');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', `connection-wire ${hasRisk ? 'risk-wire' : ''}`);
    path.setAttribute('marker-end', hasRisk ? 'url(#arrow-error)' : 'url(#arrow)');
    svgConnections.appendChild(path);
  });

  // Render Nodes
  state.nodes.forEach(node => {
    const spec = COMPONENT_SPECS[node.type];
    const isSelected = node.id === state.selectedNodeId;
    const hasRisk = state.auditFindings.some(f => f.nodeId === node.id);

    const nodeEl = document.createElement('div');
    nodeEl.className = `canvas-node ${isSelected ? 'selected' : ''} ${hasRisk ? 'has-risk' : ''}`;
    nodeEl.style.transform = `translate(${node.x}px, ${node.y}px)`;

    nodeEl.innerHTML = `
      <div class="node-header">
        <div class="node-title-group">
          <div class="node-badge ${spec.category}-bg">${spec.badge}</div>
          <span class="node-title">${node.label}</span>
        </div>
      </div>
      <div class="node-body">
        <div class="node-detail-row">
          <span>Tier:</span>
          <span class="node-detail-val">${node.props.instanceType}</span>
        </div>
        <div class="node-detail-row">
          <span>Cost:</span>
          <span class="node-detail-val">$${calculateSingleNodeCost(node).toFixed(2)}/mo</span>
        </div>
      </div>
      <div class="node-ports">
        <div class="port-handle in-port" data-id="${node.id}" title="Input Port"></div>
        <div class="port-handle out-port" data-id="${node.id}" title="Drag to connect"></div>
      </div>
    `;

    // Event Handlers for Dragging Node
    nodeEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('port-handle')) return;
      state.selectedNodeId = node.id;
      updateWorkspace();

      let startX = e.clientX;
      let startY = e.clientY;

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / state.zoom;
        const dy = (moveEvent.clientY - startY) / state.zoom;

        node.x += dx;
        node.y += dy;

        if (state.gridSnap) {
          node.x = Math.round(node.x / 20) * 20;
          node.y = Math.round(node.y / 20) * 20;
        }

        startX = moveEvent.clientX;
        startY = moveEvent.clientY;
        renderCanvas();
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        updateWorkspace();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Connection Drag Handler
    const outPort = nodeEl.querySelector('.out-port');
    outPort.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.isConnecting = true;
      state.connectingSourceId = node.id;

      const onPortMouseUp = (upEvent) => {
        const targetPort = upEvent.target.closest('.port-handle');
        if (targetPort && targetPort.getAttribute('data-id') !== node.id) {
          connectNodes(node.id, targetPort.getAttribute('data-id'));
        }
        state.isConnecting = false;
        state.connectingSourceId = null;
        document.removeEventListener('mouseup', onPortMouseUp);
        updateWorkspace();
      };

      document.addEventListener('mouseup', onPortMouseUp);
    });

    nodesContainer.appendChild(nodeEl);
  });

  // Update Toolbar Summary Metrics
  document.getElementById('nodeCount').innerText = `${state.nodes.length} Nodes`;
  document.getElementById('connectionCount').innerText = `${state.connections.length} Connections`;
}

// COST CALCULATOR ENGINE
function calculateSingleNodeCost(node) {
  const spec = COMPONENT_SPECS[node.type];
  let cost = spec.basePrice;

  if (node.props.instanceCount) {
    cost *= node.props.instanceCount;
  }

  if (node.props.storageGb) {
    cost += node.props.storageGb * 0.10; // $0.10 per GB
  }

  if (node.props.requestsPerSec) {
    cost += (node.props.requestsPerSec / 100) * 2.50; // Requests pricing factor
  }

  if (node.props.multiAz) {
    cost *= 1.8; // Multi-AZ HA cost multiplier
  }

  return Math.round(cost * 100) / 100;
}

function calculateCosts() {
  let total = 0;
  state.nodes.forEach(node => {
    total += calculateSingleNodeCost(node);
  });
  state.totalMonthlyCost = Math.round(total * 100) / 100;

  document.getElementById('headerCostValue').innerText = `$${state.totalMonthlyCost.toFixed(2)}/mo`;
}

// SLA & AVAILABILITY CALCULATOR
function calculateSla() {
  if (state.nodes.length === 0) {
    state.slaAvailability = 100;
  } else {
    let totalSlaMultiplier = 1.0;
    state.nodes.forEach(node => {
      const spec = COMPONENT_SPECS[node.type];
      let itemSla = spec.sla;
      if (node.props.multiAz) {
        itemSla = 100 - ((100 - itemSla) * 0.2); // Multi-AZ uptime boost
      }
      totalSlaMultiplier *= (itemSla / 100);
    });
    state.slaAvailability = Math.min(99.999, Math.max(90.0, totalSlaMultiplier * 100));
  }

  const yearlyDowntimeHours = ((100 - state.slaAvailability) / 100) * 8760;
  document.getElementById('metricsSlaValue').innerText = `${state.slaAvailability.toFixed(3)}%`;
  document.querySelector('.sla-sub').innerText = `Est. Downtime: ~${yearlyDowntimeHours.toFixed(2)} hours/year`;
}

// AUTOMATED SECURITY & RELIABILITY AUDITOR ENGINE
function runSecurityAudit() {
  state.auditFindings = [];

  state.nodes.forEach(node => {
    // Audit Rule 1: Exposed Database
    if ((node.type === 'rds' || node.type === 'redis') && node.props.publicAccess) {
      state.auditFindings.push({
        id: 'SEC-001',
        nodeId: node.id,
        severity: 'danger',
        title: `Exposed Database: ${node.label}`,
        description: 'Database is publicly accessible over the internet without Subnet/WAF boundary.',
        fixAction: () => { node.props.publicAccess = false; }
      });
    }

    // Audit Rule 2: Unencrypted Storage / Bucket
    if ((node.type === 's3' || node.type === 'rds') && !node.props.encryption) {
      state.auditFindings.push({
        id: 'SEC-002',
        nodeId: node.id,
        severity: 'warning',
        title: `Unencrypted Storage: ${node.label}`,
        description: 'Storage component lacks KMS server-side encryption at rest.',
        fixAction: () => { node.props.encryption = true; }
      });
    }

    // Audit Rule 3: Single Point of Failure (SPOF)
    if ((node.type === 'ec2' || node.type === 'rds' || node.type === 'eks') && !node.props.multiAz) {
      state.auditFindings.push({
        id: 'REL-001',
        nodeId: node.id,
        severity: 'warning',
        title: `Single Point of Failure: ${node.label}`,
        description: 'Component is not deployed in Multi-AZ High Availability mode.',
        fixAction: () => { node.props.multiAz = true; }
      });
    }
  });

  // Audit Rule 4: Missing WAF/CDN on Public Ingress
  const publicIngressNodes = state.nodes.filter(n => n.type === 'alb' || n.type === 'apigateway');
  const hasWaf = state.nodes.some(n => n.type === 'waf');
  if (publicIngressNodes.length > 0 && !hasWaf) {
    state.auditFindings.push({
      id: 'SEC-003',
      nodeId: publicIngressNodes[0].id,
      severity: 'warning',
      title: 'Missing Web Application Firewall (WAF)',
      description: 'Public load balancer or API Gateway lacks WAF protection against DDoS/OWASP Top 10.',
      fixAction: () => { spawnNode('waf', 200, 100, 'Auto-Protected WAF'); }
    });
  }

  // Calculate Security Score
  const dangerCount = state.auditFindings.filter(f => f.severity === 'danger').length;
  const warningCount = state.auditFindings.filter(f => f.severity === 'warning').length;

  state.securityScore = Math.max(0, 100 - (dangerCount * 30 + warningCount * 12));

  // Update Nav Pill
  const secPill = document.getElementById('securityPill');
  const secScoreVal = document.getElementById('headerSecurityScore');
  secScoreVal.innerText = `${state.securityScore}%`;
  
  secPill.className = 'metric-pill security-pill';
  if (state.securityScore < 70) secPill.classList.add('danger');
  else if (state.securityScore < 90) secPill.classList.add('warning');

  document.getElementById('securityBadgeCount').innerText = state.auditFindings.length;
}

function autoFixAllRisks() {
  state.auditFindings.forEach(finding => {
    if (finding.fixAction) finding.fixAction();
  });
  updateWorkspace();
}

// INSPECTOR PANEL RENDERER
function renderInspector() {
  const node = getSelectedNode();
  const formEl = document.getElementById('node-properties-form');
  const emptyEl = document.getElementById('no-selection-msg');

  if (!node) {
    emptyEl.classList.remove('hidden');
    formEl.classList.add('hidden');
  } else {
    emptyEl.classList.add('hidden');
    formEl.classList.remove('hidden');

    const spec = COMPONENT_SPECS[node.type];
    document.getElementById('nodeLabel').value = node.label;
    document.getElementById('nodeTypeBadge').innerText = `${spec.name} (${spec.badge})`;
    
    document.getElementById('propInstanceType').value = node.props.instanceType;
    document.getElementById('propInstanceCount').value = node.props.instanceCount;
    document.getElementById('valInstanceCount').innerText = node.props.instanceCount;
    
    document.getElementById('propStorageGb').value = node.props.storageGb;
    document.getElementById('valStorageGb').innerText = node.props.storageGb;

    document.getElementById('propRequestsPerSec').value = node.props.requestsPerSec;
    document.getElementById('valRequestsPerSec').innerText = node.props.requestsPerSec;

    document.getElementById('propPublicAccess').checked = node.props.publicAccess;
    document.getElementById('propMultiAz').checked = node.props.multiAz;
    document.getElementById('propEncryption').checked = node.props.encryption;

    document.getElementById('nodeItemizedCost').innerText = `$${calculateSingleNodeCost(node).toFixed(2)} / mo`;
  }

  // Security Tab List
  const auditList = document.getElementById('auditList');
  auditList.innerHTML = '';

  const scoreCircle = document.getElementById('auditScoreCircle');
  document.getElementById('auditScoreVal').innerText = `${state.securityScore}%`;
  
  scoreCircle.className = 'score-circle';
  if (state.securityScore < 70) scoreCircle.classList.add('danger');
  else if (state.securityScore < 90) scoreCircle.classList.add('warning');

  if (state.auditFindings.length === 0) {
    document.getElementById('auditStatusHeading').innerText = 'Architecture Compliant';
    document.getElementById('auditStatusSub').innerText = 'Zero vulnerabilities detected.';
    auditList.innerHTML = `<div class="empty-state"><p>All components satisfy AWS/CIS security benchmarks.</p></div>`;
  } else {
    document.getElementById('auditStatusHeading').innerText = `${state.auditFindings.length} Vulnerabilities Found`;
    document.getElementById('auditStatusSub').innerText = 'Review architectural risks below.';

    state.auditFindings.forEach(f => {
      const item = document.createElement('div');
      item.className = `audit-item ${f.severity}`;
      item.innerHTML = `
        <div class="audit-title">${f.title}</div>
        <div class="audit-desc">${f.description}</div>
        <div class="audit-action">
          <button class="btn btn-xs btn-secondary">Auto-Fix Risk</button>
        </div>
      `;
      item.querySelector('button').addEventListener('click', () => {
        if (f.fixAction) f.fixAction();
        updateWorkspace();
      });
      auditList.appendChild(item);
    });
  }

  // Cost Breakdown Tab List
  const breakdownList = document.getElementById('costBreakdownList');
  breakdownList.innerHTML = '';
  state.nodes.forEach(n => {
    const row = document.createElement('div');
    row.className = 'cost-row';
    row.innerHTML = `
      <span class="cost-row-name">${n.label}</span>
      <span class="cost-row-price">$${calculateSingleNodeCost(n).toFixed(2)}/mo</span>
    `;
    breakdownList.appendChild(row);
  });
}

// TERRAFORM IAC SYNTHESIZER ENGINE
function generateTerraformHcl() {
  let tf = `# =========================================================================\n`;
  tf += `# Synthesized Terraform HCL Manifest\n`;
  tf += `# Generated autonomously by CloudCraft Studio Engine\n`;
  tf += `# Estimated Monthly Infrastructure Cost: $${state.totalMonthlyCost.toFixed(2)}\n`;
  tf += `# Architecture Security Compliance Score: ${state.securityScore}%\n`;
  tf += `# =========================================================================\n\n`;

  tf += `terraform {\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = "~> 5.0"\n    }\n  }\n}\n\n`;
  tf += `provider "aws" {\n  region = "us-east-1"\n}\n\n`;

  state.nodes.forEach(node => {
    const spec = COMPONENT_SPECS[node.type];
    const safeName = node.label.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    tf += `# ${spec.name}: ${node.label}\n`;
    tf += `resource "${spec.iacType}" "${safeName}" {\n`;

    if (node.type === 'ec2') {
      tf += `  ami           = "ami-0c55b159cbfafe1f0"\n`;
      tf += `  instance_type = "${node.props.instanceType}"\n`;
      tf += `  count         = ${node.props.instanceCount}\n`;
      tf += `  associate_public_ip_address = ${node.props.publicAccess}\n`;
      tf += `  tags = {\n    Name = "${node.label}"\n  }\n`;
    } else if (node.type === 'rds') {
      tf += `  allocated_storage   = ${node.props.storageGb}\n`;
      tf += `  engine              = "postgres"\n`;
      tf += `  instance_class      = "db.t3.micro"\n`;
      tf += `  publicly_accessible = ${node.props.publicAccess}\n`;
      tf += `  multi_az            = ${node.props.multiAz}\n`;
      tf += `  storage_encrypted   = ${node.props.encryption}\n`;
    } else if (node.type === 's3') {
      tf += `  bucket = "cloudcraft-${safeName}-bucket"\n`;
      tf += `  force_destroy = true\n`;
    } else if (node.type === 'lambda') {
      tf += `  function_name = "${safeName}"\n`;
      tf += `  runtime       = "nodejs18.x"\n`;
      tf += `  handler       = "index.handler"\n`;
    } else if (node.type === 'alb') {
      tf += `  name               = "${safeName}"\n`;
      tf += `  internal           = ${!node.props.publicAccess}\n`;
      tf += `  load_balancer_type = "application"\n`;
    } else {
      tf += `  name = "${safeName}"\n`;
    }

    tf += `}\n\n`;
  });

  return tf;
}

function renderIaC() {
  const codeText = document.getElementById('iacCodeText');
  if (codeText) {
    codeText.innerText = generateTerraformHcl();
  }
}

// EXPORT / IMPORT MODALS & ACTIONS
function showExportModal() {
  document.getElementById('modalCodeArea').value = generateTerraformHcl();
  document.getElementById('exportModal').classList.remove('hidden');
}

function hideExportModal() {
  document.getElementById('exportModal').classList.add('hidden');
}

function copyTfCode() {
  const code = generateTerraformHcl();
  navigator.clipboard.writeText(code).then(() => {
    alert('Terraform HCL copied to clipboard!');
  });
}

function downloadTfFile() {
  const code = generateTerraformHcl();
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'main.tf';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadArchitectureJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", "cloudcraft_architecture.json");
  dlAnchorElem.click();
}

// CANVAS VIEW CONTROLS (ZOOM / AUTO LAYOUT)
function adjustZoom(delta) {
  state.zoom = Math.min(2.0, Math.max(0.4, state.zoom + delta));
  document.getElementById('viewport').style.transform = `scale(${state.zoom})`;
  document.getElementById('zoomLevel').innerText = `${Math.round(state.zoom * 100)}%`;
}

function resetView() {
  state.zoom = 1.0;
  state.pan = { x: 0, y: 0 };
  document.getElementById('viewport').style.transform = `scale(1) translate(0px, 0px)`;
  document.getElementById('zoomLevel').innerText = `100%`;
}

function autoLayoutNodes() {
  let startX = 100;
  state.nodes.forEach((node, idx) => {
    node.x = startX + (idx % 4) * 220;
    node.y = 150 + Math.floor(idx / 4) * 160;
  });
  updateWorkspace();
}