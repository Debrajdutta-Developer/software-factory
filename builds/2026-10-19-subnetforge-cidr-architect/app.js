/**
 * SubnetForge - Core IP / CIDR Engine & VPC Architect
 */
(function () {
  'use strict';

  // --- IP Address Math Helpers ---
  function ipToInt(ip) {
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return null;
    let res = 0;
    for (let i = 0; i < 4; i++) {
      const oct = parseInt(parts[i], 10);
      if (isNaN(oct) || oct < 0 || oct > 255) return null;
      res = ((res << 8) + oct) >>> 0;
    }
    return res;
  }

  function intToIp(intVal) {
    return [
      (intVal >>> 24) & 255,
      (intVal >>> 16) & 255,
      (intVal >>> 8) & 255,
      intVal & 255
    ].join('.');
  }

  function prefixToMaskInt(prefix) {
    if (prefix === 0) return 0;
    return ((0xFFFFFFFF << (32 - prefix)) >>> 0);
  }

  function parseCidr(cidrStr) {
    if (!cidrStr || typeof cidrStr !== 'string') return null;
    const parts = cidrStr.trim().split('/');
    if (parts.length !== 2) return null;
    const ip = parts[0].trim();
    const prefix = parseInt(parts[1], 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
    const ipInt = ipToInt(ip);
    if (ipInt === null) return null;

    const maskInt = prefixToMaskInt(prefix);
    const networkInt = (ipInt & maskInt) >>> 0;
    const broadcastInt = prefix === 32 ? networkInt : (networkInt | (~maskInt >>> 0)) >>> 0;
    const totalIps = prefix === 32 ? 1 : Math.pow(2, 32 - prefix);

    return {
      raw: cidrStr,
      ip,
      prefix,
      ipInt,
      maskInt,
      networkInt,
      broadcastInt,
      networkIp: intToIp(networkInt),
      broadcastIp: intToIp(broadcastInt),
      netmaskIp: intToIp(maskInt),
      wildcardIp: intToIp((~maskInt) >>> 0),
      totalIps
    };
  }

  function intToBinaryStr(intVal) {
    const octets = [
      ((intVal >>> 24) & 255).toString(2).padStart(8, '0'),
      ((intVal >>> 16) & 255).toString(2).padStart(8, '0'),
      ((intVal >>> 8) & 255).toString(2).padStart(8, '0'),
      (intVal & 255).toString(2).padStart(8, '0')
    ];
    return octets.join('.');
  }

  // Cloud Provider Usable Host Offsets
  const PROVIDER_RULES = {
    aws: {
      name: 'AWS VPC',
      reservedCount: 5,
      getDetails(netInt, bcInt, prefix) {
        if (prefix >= 31) return { usableCount: 0, firstUsable: 'N/A', lastUsable: 'N/A', list: [] };
        const reserved = [
          { ip: intToIp(netInt), desc: 'Network Address' },
          { ip: intToIp((netInt + 1) >>> 0), desc: 'VPC Router' },
          { ip: intToIp((netInt + 2) >>> 0), desc: 'Amazon DNS Server' },
          { ip: intToIp((netInt + 3) >>> 0), desc: 'Reserved for Future Use' },
          { ip: intToIp(bcInt), desc: 'Network Broadcast' }
        ];
        const usableCount = Math.max(0, Math.pow(2, 32 - prefix) - 5);
        const firstUsable = intToIp((netInt + 4) >>> 0);
        const lastUsable = intToIp((bcInt - 1) >>> 0);
        return { usableCount, firstUsable, lastUsable, list: reserved };
      }
    },
    azure: {
      name: 'Azure VNet',
      reservedCount: 5,
      getDetails(netInt, bcInt, prefix) {
        if (prefix >= 31) return { usableCount: 0, firstUsable: 'N/A', lastUsable: 'N/A', list: [] };
        const reserved = [
          { ip: intToIp(netInt), desc: 'Network Address' },
          { ip: intToIp((netInt + 1) >>> 0), desc: 'Default Gateway' },
          { ip: intToIp((netInt + 2) >>> 0), desc: 'Azure DNS / WINS Mapping' },
          { ip: intToIp((netInt + 3) >>> 0), desc: 'Azure DNS / WINS Mapping' },
          { ip: intToIp(bcInt), desc: 'Network Broadcast' }
        ];
        const usableCount = Math.max(0, Math.pow(2, 32 - prefix) - 5);
        const firstUsable = intToIp((netInt + 4) >>> 0);
        const lastUsable = intToIp((bcInt - 1) >>> 0);
        return { usableCount, firstUsable, lastUsable, list: reserved };
      }
    },
    gcp: {
      name: 'Google Cloud VPC',
      reservedCount: 4,
      getDetails(netInt, bcInt, prefix) {
        if (prefix >= 31) return { usableCount: 0, firstUsable: 'N/A', lastUsable: 'N/A', list: [] };
        const reserved = [
          { ip: intToIp(netInt), desc: 'Network Address' },
          { ip: intToIp((netInt + 1) >>> 0), desc: 'Default Gateway' },
          { ip: intToIp((bcInt - 1) >>> 0), desc: 'Second-to-last (Reserved by GCP)' },
          { ip: intToIp(bcInt), desc: 'Network Broadcast' }
        ];
        const usableCount = Math.max(0, Math.pow(2, 32 - prefix) - 4);
        const firstUsable = intToIp((netInt + 2) >>> 0);
        const lastUsable = intToIp((bcInt - 2) >>> 0);
        return { usableCount, firstUsable, lastUsable, list: reserved };
      }
    },
    rfc: {
      name: 'Standard RFC 1918',
      reservedCount: 2,
      getDetails(netInt, bcInt, prefix) {
        if (prefix === 31) return { usableCount: 2, firstUsable: intToIp(netInt), lastUsable: intToIp(bcInt), list: [] };
        if (prefix === 32) return { usableCount: 1, firstUsable: intToIp(netInt), lastUsable: intToIp(netInt), list: [] };
        const reserved = [
          { ip: intToIp(netInt), desc: 'Network Address' },
          { ip: intToIp(bcInt), desc: 'Broadcast Address' }
        ];
        const usableCount = Math.max(0, Math.pow(2, 32 - prefix) - 2);
        const firstUsable = intToIp((netInt + 1) >>> 0);
        const lastUsable = intToIp((bcInt - 1) >>> 0);
        return { usableCount, firstUsable, lastUsable, list: reserved };
      }
    }
  };

  // Architecture Presets
  const PRESETS = {
    'aws-3tier': {
      rootCidr: '10.0.0.0/16',
      provider: 'aws',
      subnets: [
        { id: 'sub-1', name: 'public-subnet-1a', cidr: '10.0.0.0/24', tier: 'public' },
        { id: 'sub-2', name: 'public-subnet-1b', cidr: '10.0.1.0/24', tier: 'public' },
        { id: 'sub-3', name: 'app-private-1a', cidr: '10.0.16.0/20', tier: 'app' },
        { id: 'sub-4', name: 'app-private-1b', cidr: '10.0.32.0/20', tier: 'app' },
        { id: 'sub-5', name: 'database-1a', cidr: '10.0.64.0/24', tier: 'db' },
        { id: 'sub-6', name: 'database-1b', cidr: '10.0.65.0/24', tier: 'db' },
        { id: 'sub-7', name: 'mgmt-bastion', cidr: '10.0.128.0/26', tier: 'mgmt' }
      ]
    },
    'k8s-vpc': {
      rootCidr: '172.20.0.0/16',
      provider: 'aws',
      subnets: [
        { id: 'sub-1', name: 'k8s-control-plane-a', cidr: '172.20.0.0/24', tier: 'mgmt' },
        { id: 'sub-2', name: 'k8s-control-plane-b', cidr: '172.20.1.0/24', tier: 'mgmt' },
        { id: 'sub-3', name: 'k8s-pod-network-a', cidr: '172.20.32.0/19', tier: 'app' },
        { id: 'sub-4', name: 'k8s-pod-network-b', cidr: '172.20.64.0/19', tier: 'app' },
        { id: 'sub-5', name: 'ingress-lb-pool', cidr: '172.20.128.0/23', tier: 'public' },
        { id: 'sub-6', name: 'stateful-db-cluster', cidr: '172.20.130.0/24', tier: 'db' }
      ]
    },
    'branch-office': {
      rootCidr: '192.168.0.0/22',
      provider: 'rfc',
      subnets: [
        { id: 'sub-1', name: 'staff-wifi', cidr: '192.168.0.0/24', tier: 'app' },
        { id: 'sub-2', name: 'guest-wifi-isolated', cidr: '192.168.1.0/24', tier: 'public' },
        { id: 'sub-3', name: 'printers-and-iot', cidr: '192.168.2.0/25', tier: 'mgmt' },
        { id: 'sub-4', name: 'on-prem-servers', cidr: '192.168.2.128/26', tier: 'db' }
      ]
    },
    'micro-vpc': {
      rootCidr: '10.100.0.0/20',
      provider: 'gcp',
      subnets: [
        { id: 'sub-1', name: 'api-gateway', cidr: '10.100.0.0/24', tier: 'public' },
        { id: 'sub-2', name: 'services-backend', cidr: '10.100.1.0/23', tier: 'app' },
        { id: 'sub-3', name: 'cloud-sql-primary', cidr: '10.100.4.0/25', tier: 'db' },
        { id: 'sub-4', name: 'redis-cache-tier', cidr: '10.100.4.128/25', tier: 'db' }
      ]
    }
  };

  // State
  let state = {
    rootCidr: '10.0.0.0/16',
    provider: 'aws',
    subnets: [],
    selectedSubnetId: null,
    activeCodeFormat: 'tf-aws'
  };

  // DOM references
  const baseCidrInput = document.getElementById('baseCidrInput');
  const btnApplyRoot = document.getElementById('btnApplyRoot');
  const baseCidrError = document.getElementById('baseCidrError');
  const cloudProviderSelect = document.getElementById('cloudProviderSelect');
  const presetSelect = document.getElementById('presetSelect');
  const visualBar = document.getElementById('visualBar');
  const scaleStart = document.getElementById('scaleStart');
  const scaleMid = document.getElementById('scaleMid');
  const scaleEnd = document.getElementById('scaleEnd');
  const rootSpanLabel = document.getElementById('rootSpanLabel');

  const statTotalHosts = document.getElementById('statTotalHosts');
  const statAllocatedHosts = document.getElementById('statAllocatedHosts');
  const statFreeHosts = document.getElementById('statFreeHosts');
  const statUtilization = document.getElementById('statUtilization');
  const statHealthBadge = document.getElementById('statHealthBadge');

  const addSubnetForm = document.getElementById('addSubnetForm');
  const subName = document.getElementById('subName');
  const subTier = document.getElementById('subTier');
  const subPrefix = document.getElementById('subPrefix');
  const subIp = document.getElementById('subIp');
  const formErrorMsg = document.getElementById('formErrorMsg');
  const btnAutoPack = document.getElementById('btnAutoPack');

  const subnetTableBody = document.getElementById('subnetTableBody');
  const inspectorEmptyState = document.getElementById('inspectorEmptyState');
  const inspectorContent = document.getElementById('inspectorContent');

  const insSubnetName = document.getElementById('insSubnetName');
  const insSubnetCidr = document.getElementById('insSubnetCidr');
  const insSubnetTier = document.getElementById('insSubnetTier');
  const insNetworkIp = document.getElementById('insNetworkIp');
  const insNetmask = document.getElementById('insNetmask');
  const insWildcard = document.getElementById('insWildcard');
  const insBroadcast = document.getElementById('insBroadcast');
  const insUsableRange = document.getElementById('insUsableRange');
  const insTotalIps = document.getElementById('insTotalIps');
  const insUsableHosts = document.getElementById('insUsableHosts');
  const insProviderTitle = document.getElementById('insProviderTitle');
  const insReservedList = document.getElementById('insReservedList');
  const insBinaryMask = document.getElementById('insBinaryMask');

  const freeBlocksCount = document.getElementById('freeBlocksCount');
  const freeBlocksList = document.getElementById('freeBlocksList');
  const codeOutput = document.getElementById('codeOutput');
  const btnCopyCode = document.getElementById('btnCopyCode');
  const copyStatusText = document.getElementById('copyStatusText');

  const btnExportConfig = document.getElementById('btnExportConfig');
  const btnImportConfig = document.getElementById('btnImportConfig');
  const fileImport = document.getElementById('fileImport');
  const btnReset = document.getElementById('btnReset');

  // Populate prefix options
  function populatePrefixDropdown(rootPrefix) {
    subPrefix.innerHTML = '';
    const minP = Math.max(8, rootPrefix);
    for (let p = minP; p <= 30; p++) {
      const hosts = Math.pow(2, 32 - p);
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = `/${p} (${hosts.toLocaleString()} IPs)`;
      if (p === Math.min(24, Math.max(minP, 24))) {
        opt.selected = true;
      }
      subPrefix.appendChild(opt);
    }
  }

  // Collision & Validation Math
  function analyzeSubnets() {
    const parsedRoot = parseCidr(state.rootCidr);
    if (!parsedRoot) return { parsedRoot: null, enriched: [], collisions: new Set(), totalAllocated: 0, gaps: [] };

    const enriched = [];
    const collisions = new Set();

    state.subnets.forEach((s) => {
      const parsed = parseCidr(s.cidr);
      let isOutsideRoot = false;

      if (parsed) {
        if (parsed.networkInt < parsedRoot.networkInt || parsed.broadcastInt > parsedRoot.broadcastInt) {
          isOutsideRoot = true;
        }
      }

      enriched.push({
        ...s,
        parsed,
        isOutsideRoot
      });
    });

    // Detect overlapping pairs
    for (let i = 0; i < enriched.length; i++) {
      for (let j = i + 1; j < enriched.length; j++) {
        const a = enriched[i].parsed;
        const b = enriched[j].parsed;
        if (!a || !b) continue;

        const overlap = Math.max(a.networkInt, b.networkInt) <= Math.min(a.broadcastInt, b.broadcastInt);
        if (overlap) {
          collisions.add(enriched[i].id);
          collisions.add(enriched[j].id);
        }
      }
    }

    // Merge intervals for statistics and gaps
    const validIntervals = [];
    enriched.forEach((item) => {
      if (item.parsed && !item.isOutsideRoot) {
        validIntervals.push({
          start: item.parsed.networkInt,
          end: item.parsed.broadcastInt
        });
      }
    });

    validIntervals.sort((a, b) => a.start - b.start);

    const merged = [];
    for (const cur of validIntervals) {
      if (!merged.length) {
        merged.push({ start: cur.start, end: cur.end });
      } else {
        const prev = merged[merged.length - 1];
        if (cur.start <= prev.end + 1) {
          prev.end = Math.max(prev.end, cur.end);
        } else {
          merged.push({ start: cur.start, end: cur.end });
        }
      }
    }

    let totalAllocated = 0;
    merged.forEach(m => {
      totalAllocated += (m.end - m.start + 1);
    });

    // Calculate gaps inside root
    const gaps = [];
    let pointer = parsedRoot.networkInt;
    for (const m of merged) {
      if (m.start > pointer) {
        gaps.push({ start: pointer, end: (m.start - 1) >>> 0 });
      }
      pointer = (m.end + 1) >>> 0;
    }
    if (pointer <= parsedRoot.broadcastInt) {
      gaps.push({ start: pointer, end: parsedRoot.broadcastInt });
    }

    return {
      parsedRoot,
      enriched,
      collisions,
      totalAllocated,
      gaps
    };
  }

  // Decompose [start, end] into largest valid CIDR blocks
  function intervalToCidrs(startInt, endInt) {
    const cidrs = [];
    let cur = startInt;
    while (cur <= endInt) {
      let maxPrefix = 32;
      while (maxPrefix > 0) {
        const mask = prefixToMaskInt(maxPrefix - 1);
        const blockSize = Math.pow(2, 32 - (maxPrefix - 1));
        const isAligned = (cur & mask) === cur;
        const fitsInGap = (cur + blockSize - 1) <= endInt;
        if (isAligned && fitsInGap) {
          maxPrefix--;
        } else {
          break;
        }
      }
      const blockSize = Math.pow(2, 32 - maxPrefix);
      cidrs.push({
        cidr: `${intToIp(cur)}/${maxPrefix}`,
        networkInt: cur,
        prefix: maxPrefix,
        size: blockSize
      });
      cur = (cur + blockSize) >>> 0;
    }
    return cidrs;
  }

  // Find next non-overlapping CIDR block
  function findNextAvailableCidr(prefix) {
    const { parsedRoot, gaps } = analyzeSubnets();
    if (!parsedRoot) return null;
    const neededSize = Math.pow(2, 32 - prefix);

    for (const gap of gaps) {
      const gapSize = gap.end - gap.start + 1;
      if (gapSize < neededSize) continue;

      const mask = prefixToMaskInt(prefix);
      let candidate = (gap.start & mask) >>> 0;
      if (candidate < gap.start) {
        candidate = (candidate + neededSize) >>> 0;
      }
      if ((candidate + neededSize - 1) <= gap.end) {
        return `${intToIp(candidate)}/${prefix}`;
      }
    }
    return null;
  }

  // Render
  function render() {
    const parsedRoot = parseCidr(state.rootCidr);
    if (!parsedRoot) return;

    const { enriched, collisions, totalAllocated, gaps } = analyzeSubnets();

    const totalIps = parsedRoot.totalIps;
    const freeIps = Math.max(0, totalIps - totalAllocated);
    const utilPercent = ((totalAllocated / totalIps) * 100).toFixed(1);

    statTotalHosts.textContent = totalIps.toLocaleString();
    statAllocatedHosts.textContent = totalAllocated.toLocaleString();
    statFreeHosts.textContent = freeIps.toLocaleString();
    statUtilization.textContent = `${utilPercent}%`;

    if (collisions.size > 0) {
      statHealthBadge.textContent = `${collisions.size} Collisions`;
      statHealthBadge.className = 'stat-value badge warn';
    } else {
      statHealthBadge.textContent = 'Clean & Aligned';
      statHealthBadge.className = 'stat-value badge ok';
    }

    rootSpanLabel.textContent = state.rootCidr;
    scaleStart.textContent = parsedRoot.networkIp;
    scaleMid.textContent = intToIp((parsedRoot.networkInt + (totalIps / 2)) >>> 0);
    scaleEnd.textContent = parsedRoot.broadcastIp;

    renderVisualBar(parsedRoot, enriched, collisions);
    renderSubnetTable(enriched, collisions);
    renderInspector(enriched);
    renderFreeBlocks(gaps);
    renderCodeExport(enriched);
  }

  function renderVisualBar(parsedRoot, enriched, collisions) {
    visualBar.innerHTML = '';
    const rootStart = parsedRoot.networkInt;
    const rootTotal = parsedRoot.totalIps;

    const sorted = [...enriched].filter(s => s.parsed && !s.isOutsideRoot);
    sorted.sort((a, b) => a.parsed.networkInt - b.parsed.networkInt);

    let cursor = rootStart;

    for (const sub of sorted) {
      if (sub.parsed.networkInt > cursor) {
        const gapSize = sub.parsed.networkInt - cursor;
        const gapPct = (gapSize / rootTotal) * 100;
        const gapEl = document.createElement('div');
        gapEl.className = 'v-block free-block';
        gapEl.style.width = `${gapPct}%`;
        gapEl.title = `Free Space: ${intToIp(cursor)} (${gapSize.toLocaleString()} IPs) - Click to allocate`;
        gapEl.addEventListener('click', () => {
          subIp.value = intToIp(cursor);
          subName.focus();
        });
        if (gapPct > 5) {
          const text = document.createElement('span');
          text.className = 'v-block-text';
          text.textContent = 'Free';
          gapEl.appendChild(text);
        }
        visualBar.appendChild(gapEl);
        cursor = sub.parsed.networkInt;
      }

      const isColliding = collisions.has(sub.id);
      const subSize = sub.parsed.totalIps;
      const subPct = (subSize / rootTotal) * 100;
      const blockEl = document.createElement('div');
      blockEl.className = `v-block tier-${sub.tier} ${isColliding ? 'collision-block' : ''} ${state.selectedSubnetId === sub.id ? 'selected' : ''}`;
      blockEl.style.width = `${Math.max(subPct, 0.4)}%`;
      blockEl.title = `${sub.name} (${sub.cidr})\nTier: ${sub.tier}\nIPs: ${subSize.toLocaleString()}${isColliding ? ' [COLLISION]' : ''}`;

      blockEl.addEventListener('click', () => {
        state.selectedSubnetId = sub.id;
        render();
      });

      if (subPct > 4) {
        const text = document.createElement('span');
        text.className = 'v-block-text';
        text.textContent = sub.name;
        blockEl.appendChild(text);
      }

      visualBar.appendChild(blockEl);
      cursor = Math.max(cursor, (sub.parsed.broadcastInt + 1) >>> 0);
    }

    if (cursor <= parsedRoot.broadcastInt) {
      const gapSize = parsedRoot.broadcastInt - cursor + 1;
      const gapPct = (gapSize / rootTotal) * 100;
      const gapEl = document.createElement('div');
      gapEl.className = 'v-block free-block';
      gapEl.style.width = `${gapPct}%`;
      gapEl.title = `Free Space: ${intToIp(cursor)} (${gapSize.toLocaleString()} IPs) - Click to allocate`;
      gapEl.addEventListener('click', () => {
        subIp.value = intToIp(cursor);
        subName.focus();
      });
      if (gapPct > 5) {
        const text = document.createElement('span');
        text.className = 'v-block-text';
        text.textContent = 'Free';
        gapEl.appendChild(text);
      }
      visualBar.appendChild(gapEl);
    }
  }

  function renderSubnetTable(enriched, collisions) {
    subnetTableBody.innerHTML = '';
    if (enriched.length === 0) {
      const emptyTr = document.createElement('tr');
      emptyTr.innerHTML = '<td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No subnets defined. Choose a preset above or add a subnet using the form.</td>';
      subnetTableBody.appendChild(emptyTr);
      return;
    }

    enriched.forEach((sub) => {
      const tr = document.createElement('tr');
      if (state.selectedSubnetId === sub.id) {
        tr.className = 'selected';
      }

      const hasCollision = collisions.has(sub.id);
      const rule = PROVIDER_RULES[state.provider] || PROVIDER_RULES.aws;
      let usableInfo = 'N/A';
      let ipRange = 'Invalid CIDR';

      if (sub.parsed) {
        const details = rule.getDetails(sub.parsed.networkInt, sub.parsed.broadcastInt, sub.parsed.prefix);
        usableInfo = `${details.usableCount.toLocaleString()} hosts`;
        ipRange = `${sub.parsed.networkIp} - ${sub.parsed.broadcastIp}`;
      }

      tr.innerHTML = `
        <td>
          <span class="status-dot ${hasCollision || sub.isOutsideRoot ? 'conflict' : 'ok'}" 
                title="${hasCollision ? 'Overlap detected' : sub.isOutsideRoot ? 'Outside Root CIDR' : 'Valid'}"></span>
        </td>
        <td>
          <strong>${escapeHtml(sub.name)}</strong>
          <span class="tier-pill tier-${sub.tier}">${escapeHtml(sub.tier)}</span>
          ${sub.isOutsideRoot ? '<span class="badge warn" style="font-size:0.65rem; margin-left:4px;">Out of Root</span>' : ''}
        </td>
        <td><span class="mono-badge">${escapeHtml(sub.cidr)}</span></td>
        <td class="mono" style="font-size:0.78rem;">${ipRange}</td>
        <td class="mono" style="font-size:0.8rem; font-weight:600;">${usableInfo}</td>
        <td>
          <div class="action-btns">
            <button class="btn secondary sm btn-split" data-id="${sub.id}" title="Split into two smaller /${sub.parsed ? sub.parsed.prefix + 1 : ''} subnets">
              Split
            </button>
            <button class="btn danger-outline sm btn-del" data-id="${sub.id}" title="Delete this subnet">
              &times;
            </button>
          </div>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        state.selectedSubnetId = sub.id;
        render();
      });

      subnetTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        deleteSubnet(id);
      });
    });

    document.querySelectorAll('.btn-split').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        splitSubnet(id);
      });
    });
  }

  function renderInspector(enriched) {
    const current = enriched.find(s => s.id === state.selectedSubnetId);
    if (!current || !current.parsed) {
      inspectorEmptyState.style.display = 'block';
      inspectorContent.style.display = 'none';
      return;
    }

    inspectorEmptyState.style.display = 'none';
    inspectorContent.style.display = 'flex';

    insSubnetName.textContent = current.name;
    insSubnetCidr.textContent = current.cidr;
    insSubnetTier.textContent = current.tier.toUpperCase();
    insSubnetTier.className = `tier-pill tier-${current.tier}`;

    insNetworkIp.textContent = current.parsed.networkIp;
    insNetmask.textContent = current.parsed.netmaskIp;
    insWildcard.textContent = current.parsed.wildcardIp;
    insBroadcast.textContent = current.parsed.broadcastIp;

    const rule = PROVIDER_RULES[state.provider] || PROVIDER_RULES.aws;
    const details = rule.getDetails(current.parsed.networkInt, current.parsed.broadcastInt, current.parsed.prefix);

    insUsableRange.textContent = `${details.firstUsable} → ${details.lastUsable}`;
    insTotalIps.textContent = current.parsed.totalIps.toLocaleString();
    insUsableHosts.textContent = `${details.usableCount.toLocaleString()} usable`;
    insProviderTitle.textContent = rule.name;

    insReservedList.innerHTML = '';
    if (details.list.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'None or point-to-point';
      insReservedList.appendChild(li);
    } else {
      details.list.forEach(res => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="mono text-accent">${res.ip}</span> <span class="reserved-ip-label">${res.desc}</span>`;
        insReservedList.appendChild(li);
      });
    }

    insBinaryMask.textContent = intToBinaryStr(current.parsed.maskInt);
  }

  function renderFreeBlocks(gaps) {
    freeBlocksList.innerHTML = '';
    let allDecomposed = [];

    gaps.forEach(gap => {
      const blocks = intervalToCidrs(gap.start, gap.end);
      allDecomposed = allDecomposed.concat(blocks);
    });

    freeBlocksCount.textContent = allDecomposed.length;

    if (allDecomposed.length === 0) {
      freeBlocksList.innerHTML = '<div class="empty-hint">No unallocated blocks left inside root CIDR.</div>';
      return;
    }

    allDecomposed.forEach(b => {
      const div = document.createElement('div');
      div.className = 'free-block-row';
      div.innerHTML = `
        <div>
          <span class="mono-badge" style="color:#3fb950;">${b.cidr}</span>
          <span style="margin-left: 0.5rem; color: var(--text-muted);">(${b.size.toLocaleString()} IPs)</span>
        </div>
        <button class="btn secondary sm btn-use-free" data-cidr="${b.cidr}">Use Block</button>
      `;
      freeBlocksList.appendChild(div);
    });

    document.querySelectorAll('.btn-use-free').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const c = e.currentTarget.getAttribute('data-cidr');
        const parts = c.split('/');
        subIp.value = parts[0];
        subPrefix.value = parts[1];
        subName.value = `subnet-${parts[0].replace(/\./g, '-')}`;
        subName.focus();
      });
    });
  }

  function renderCodeExport(enriched) {
    const validSubnets = enriched.filter(s => s.parsed && !s.isOutsideRoot);
    const fmt = state.activeCodeFormat;
    let output = '';

    switch (fmt) {
      case 'tf-aws':
        output = generateTerraformAws(validSubnets);
        break;
      case 'tf-azure':
        output = generateTerraformAzure(validSubnets);
        break;
      case 'yaml':
        output = generateYaml(validSubnets);
        break;
      case 'json':
        output = generateJson(validSubnets);
        break;
      case 'csv':
        output = generateCsv(validSubnets);
        break;
      default:
        output = '// Select an export format';
    }

    codeOutput.textContent = output;
  }

  // Code Generators
  function generateTerraformAws(subnets) {
    const lines = [
      '# Terraform AWS VPC & Subnets Specification',
      `resource "aws_vpc" "main" {`,
      `  cidr_block           = "${state.rootCidr}"`,
      `  enable_dns_hostnames = true`,
      `  enable_dns_support   = true`,
      `  tags = {`,
      `    Name = "vpc-${state.rootCidr.replace('/', '-')}"`,
      `  }`,
      `}\n`
    ];

    subnets.forEach((sub) => {
      const safeId = sub.name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`resource "aws_subnet" "${safeId}" {`);
      lines.push(`  vpc_id            = aws_vpc.main.id`);
      lines.push(`  cidr_block        = "${sub.cidr}"`);
      if (sub.tier === 'public') {
        lines.push(`  map_public_ip_on_launch = true`);
      }
      lines.push(`  tags = {`);
      lines.push(`    Name = "${sub.name}"`);
      lines.push(`    Tier = "${sub.tier}"`);
      lines.push(`  }`);
      lines.push(`}\n`);
    });

    return lines.join('\n');
  }

  function generateTerraformAzure(subnets) {
    const lines = [
      '# Terraform Azure VNet & Subnet Resources',
      `resource "azurerm_virtual_network" "vnet" {`,
      `  name                = "vnet-${state.rootCidr.replace('/', '-')}"`,
      `  address_space       = ["${state.rootCidr}"]`,
      `  location            = "eastus"`,
      `  resource_group_name = "rg-network"`,
      `}\n`
    ];

    subnets.forEach(sub => {
      const safeId = sub.name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`resource "azurerm_subnet" "${safeId}" {`);
      lines.push(`  name                 = "${sub.name}"`);
      lines.push(`  resource_group_name  = "rg-network"`);
      lines.push(`  virtual_network_name = azurerm_virtual_network.vnet.name`);
      lines.push(`  address_prefixes     = ["${sub.cidr}"]`);
      lines.push(`}\n`);
    });

    return lines.join('\n');
  }

  function generateYaml(subnets) {
    let yaml = `vpc:\n  cidr: "${state.rootCidr}"\n  cloud_provider: "${state.provider}"\n  subnets:\n`;
    subnets.forEach(s => {
      yaml += `    - name: "${s.name}"\n`;
      yaml += `      cidr: "${s.cidr}"\n`;
      yaml += `      tier: "${s.tier}"\n`;
      yaml += `      network_ip: "${s.parsed.networkIp}"\n`;
      yaml += `      netmask: "${s.parsed.netmaskIp}"\n`;
      yaml += `      total_hosts: ${s.parsed.totalIps}\n`;
    });
    return yaml;
  }

  function generateJson(subnets) {
    const payload = {
      rootCidr: state.rootCidr,
      cloudProvider: state.provider,
      subnets: subnets.map(s => ({
        name: s.name,
        cidr: s.cidr,
        tier: s.tier,
        network: s.parsed.networkIp,
        broadcast: s.parsed.broadcastIp,
        netmask: s.parsed.netmaskIp,
        totalIps: s.parsed.totalIps
      }))
    };
    return JSON.stringify(payload, null, 2);
  }

  function generateCsv(subnets) {
    const headers = ['Name', 'CIDR', 'Tier', 'Network IP', 'Broadcast IP', 'Netmask', 'Total IPs'];
    const rows = subnets.map(s => [
      `"${s.name}"`,
      `"${s.cidr}"`,
      `"${s.tier}"`,
      `"${s.parsed.networkIp}"`,
      `"${s.parsed.broadcastIp}"`,
      `"${s.parsed.netmaskIp}"`,
      s.parsed.totalIps
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Subnet Operations
  function deleteSubnet(id) {
    state.subnets = state.subnets.filter(s => s.id !== id);
    if (state.selectedSubnetId === id) {
      state.selectedSubnetId = state.subnets[0]?.id || null;
    }
    saveState();
    render();
  }

  function splitSubnet(id) {
    const target = state.subnets.find(s => s.id === id);
    if (!target) return;
    const parsed = parseCidr(target.cidr);
    if (!parsed || parsed.prefix >= 31) {
      alert('Cannot split a /31 or /32 subnet further.');
      return;
    }

    const newPrefix = parsed.prefix + 1;
    const halfSize = Math.pow(2, 32 - newPrefix);

    const subA = {
      id: 'sub-' + Date.now() + '-a',
      name: `${target.name}-a`,
      cidr: `${parsed.networkIp}/${newPrefix}`,
      tier: target.tier
    };

    const subB = {
      id: 'sub-' + Date.now() + '-b',
      name: `${target.name}-b`,
      cidr: `${intToIp((parsed.networkInt + halfSize) >>> 0)}/${newPrefix}`,
      tier: target.tier
    };

    const idx = state.subnets.findIndex(s => s.id === id);
    state.subnets.splice(idx, 1, subA, subB);
    state.selectedSubnetId = subA.id;
    saveState();
    render();
  }

  function autoAddNext() {
    const prefix = parseInt(subPrefix.value, 10) || 24;
    const nextCidr = findNextAvailableCidr(prefix);
    if (!nextCidr) {
      formErrorMsg.textContent = `No free space found for a /${prefix} subnet inside root CIDR.`;
      return;
    }
    const nextSub = {
      id: 'sub-' + Date.now(),
      name: `subnet-tier-${state.subnets.length + 1}`,
      cidr: nextCidr,
      tier: subTier.value
    };
    state.subnets.push(nextSub);
    state.selectedSubnetId = nextSub.id;
    formErrorMsg.textContent = '';
    saveState();
    render();
  }

  // State persistence
  function saveState() {
    try {
      localStorage.setItem('subnetforge_state', JSON.stringify({
        rootCidr: state.rootCidr,
        provider: state.provider,
        subnets: state.subnets
      }));
    } catch (e) {
      // Local storage may be restricted
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('subnetforge_state');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.rootCidr && parseCidr(data.rootCidr)) {
          state.rootCidr = data.rootCidr;
          state.provider = data.provider || 'aws';
          state.subnets = Array.isArray(data.subnets) ? data.subnets : [];
          if (state.subnets.length > 0) {
            state.selectedSubnetId = state.subnets[0].id;
          }
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  }

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    state.rootCidr = preset.rootCidr;
    state.provider = preset.provider;
    state.subnets = JSON.parse(JSON.stringify(preset.subnets));
    state.selectedSubnetId = state.subnets[0]?.id || null;

    baseCidrInput.value = state.rootCidr;
    cloudProviderSelect.value = state.provider;
    const parsedRoot = parseCidr(state.rootCidr);
    if (parsedRoot) {
      populatePrefixDropdown(parsedRoot.prefix);
    }
    saveState();
    render();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"/]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
      '/': '&#x2F;'
    }[tag] || tag));
  }

  // Event Listeners
  btnApplyRoot.addEventListener('click', () => {
    const val = baseCidrInput.value.trim();
    const parsed = parseCidr(val);
    if (!parsed) {
      baseCidrError.textContent = 'Invalid IPv4 CIDR (expected e.g. 10.0.0.0/16)';
      return;
    }
    baseCidrError.textContent = '';
    state.rootCidr = parsed.raw;
    populatePrefixDropdown(parsed.prefix);
    saveState();
    render();
  });

  baseCidrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnApplyRoot.click();
    }
  });

  cloudProviderSelect.addEventListener('change', (e) => {
    state.provider = e.target.value;
    saveState();
    render();
  });

  presetSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      applyPreset(e.target.value);
    }
  });

  addSubnetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formErrorMsg.textContent = '';

    const name = subName.value.trim();
    const tier = subTier.value;
    const prefix = parseInt(subPrefix.value, 10);
    const manualIp = subIp.value.trim();

    if (!name) {
      formErrorMsg.textContent = 'Subnet name is required.';
      return;
    }

    let cidrToAssign = '';
    if (manualIp) {
      const parsed = parseCidr(manualIp.includes('/') ? manualIp : `${manualIp}/${prefix}`);
      if (!parsed) {
        formErrorMsg.textContent = 'Invalid IP address provided.';
        return;
      }
      cidrToAssign = `${parsed.networkIp}/${parsed.prefix}`;
    } else {
      const next = findNextAvailableCidr(prefix);
      if (!next) {
        formErrorMsg.textContent = `No consecutive free range available for a /${prefix} subnet.`;
        return;
      }
      cidrToAssign = next;
    }

    const newSubnet = {
      id: 'sub-' + Date.now(),
      name,
      cidr: cidrToAssign,
      tier
    };

    state.subnets.push(newSubnet);
    state.selectedSubnetId = newSubnet.id;

    subName.value = '';
    subIp.value = '';
    saveState();
    render();
  });

  btnAutoPack.addEventListener('click', () => {
    autoAddNext();
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const tabId = e.currentTarget.getAttribute('data-tab');
      document.getElementById(tabId)?.classList.add('active');
    });
  });

  // Code export format navigation
  document.querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.activeCodeFormat = e.currentTarget.getAttribute('data-format');
      const { enriched } = analyzeSubnets();
      renderCodeExport(enriched);
    });
  });

  // Copy button
  btnCopyCode.addEventListener('click', () => {
    const text = codeOutput.textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyStatusText.textContent = 'Copied!';
      setTimeout(() => {
        copyStatusText.textContent = 'Copy Code';
      }, 2000);
    }).catch(() => {
      copyStatusText.textContent = 'Failed to copy';
    });
  });

  // JSON File Export
  btnExportConfig.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `subnetforge-${state.rootCidr.replace('/', '-')}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // JSON File Import
  btnImportConfig.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.rootCidr && parseCidr(parsed.rootCidr)) {
          state.rootCidr = parsed.rootCidr;
          state.provider = parsed.provider || 'aws';
          state.subnets = Array.isArray(parsed.subnets) ? parsed.subnets : [];
          state.selectedSubnetId = state.subnets[0]?.id || null;
          baseCidrInput.value = state.rootCidr;
          cloudProviderSelect.value = state.provider;
          populatePrefixDropdown(parseCidr(state.rootCidr).prefix);
          saveState();
          render();
        } else {
          alert('Invalid SubnetForge JSON format.');
        }
      } catch (err) {
        alert('Unable to parse file as JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  btnReset.addEventListener('click', () => {
    if (confirm('Reset workspace and remove all subnets?')) {
      state.subnets = [];
      state.selectedSubnetId = null;
      saveState();
      render();
    }
  });

  // Boot
  function init() {
    const hasLoaded = loadState();
    if (!hasLoaded) {
      applyPreset('aws-3tier');
    } else {
      baseCidrInput.value = state.rootCidr;
      cloudProviderSelect.value = state.provider;
      const parsed = parseCidr(state.rootCidr);
      if (parsed) {
        populatePrefixDropdown(parsed.prefix);
      }
      render();
    }
  }

  init();
})();
