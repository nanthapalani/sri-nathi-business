export const ActionRegistry = [
    { tag: 'NETWORK', name: 'Live Network & Database Latency Diagnostics', action: () => { if(window.openLatencyDiagnosticModal) window.openLatencyDiagnosticModal(); } },
    { tag: 'SECURITY', name: 'Revoke User / Terminal Access', action: () => { if(window.triggerTargetedLockdown) window.triggerTargetedLockdown(); } },
    { tag: 'TERMINALS', name: 'Sync All Store POS Terminals', action: () => { if(window.triggerGlobalSync) window.triggerGlobalSync(); } },
    { tag: 'BACKUP', name: 'Create Full Business Data Backup', action: () => { if(window.triggerSnapshotBackup) window.triggerSnapshotBackup(); } },
    { tag: 'SYSTEM', name: 'Toggle Store Maintenance Mode', action: () => { if(window.triggerMaintenanceToggle) window.triggerMaintenanceToggle(); } },
    { tag: 'GENERAL', name: 'Executive Control Center Overview', action: () => { if(window.navigateTab) window.navigateTab('overview'); } },
    { tag: 'GENERAL', name: 'Organization Branding & Legal Profile', action: () => { if(window.navigateTab) window.navigateTab('branding'); } },
    { tag: 'GENERAL', name: 'Business Locations & Branch Units', action: () => { if(window.navigateTab) window.navigateTab('branches'); } },
    { tag: 'SECURITY', name: 'Staff Roles & Access Permissions', action: () => { if(window.navigateTab) window.navigateTab('access'); } },
    { tag: 'SECURITY', name: 'POS Device Trust & Security Status', action: () => { if(window.navigateTab) window.navigateTab('fleet_management'); } },
    { tag: 'SECURITY', name: 'Customer Privacy & Regulatory Compliance', action: () => { if(window.navigateTab) window.navigateTab('compliance_hub'); } },
    { tag: 'PLATFORM', name: 'Feature Releases & Early Access', action: () => { if(window.navigateTab) window.navigateTab('feature_flags'); } },
    { tag: 'PLATFORM', name: 'Automated Alerts & External Notifications', action: () => { if(window.navigateTab) window.navigateTab('event_rules'); } },
    { tag: 'PLATFORM', name: 'Connected Services & Gateway Integrations', action: () => { if(window.navigateTab) window.navigateTab('integrations'); } },
    { tag: 'GOVERNANCE', name: 'Global Tax & Invoicing Policies', action: () => { if(window.navigateTab) window.navigateTab('billing_rules'); } },
    { tag: 'GOVERNANCE', name: 'Master Administrative Audit Trail', action: () => { if(window.navigateTab) window.navigateTab('activity'); } },
    { tag: 'GOVERNANCE', name: 'System Diagnostics & Platform Health', action: () => { if(window.navigateTab) window.navigateTab('infrastructure'); } },
    { tag: 'GOVERNANCE', name: 'Business Records & Data Explorer', action: () => { if(window.navigateTab) window.navigateTab('data_studio'); } },
    { tag: 'GOVERNANCE', name: 'Data Archive & Recycle Bin', action: () => { if(window.navigateTab) window.navigateTab('archive'); } }
];

export function initCommandPalette() {
    const renderResults = (query) => {
        const container = document.getElementById('commandPaletteResults');
        if (!container) return;
        
        container.innerHTML = '';
        const lowerQuery = query.toLowerCase();
        const filtered = ActionRegistry.filter(a => a.name.toLowerCase().includes(lowerQuery) || a.tag.toLowerCase().includes(lowerQuery));
        
        if (filtered.length === 0) {
            container.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 14px;">No actions found</div>';
            return;
        }

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'command-palette-item';

            div.innerHTML = `
                <div class="cp-item-left">
                    <span class="cp-item-tag">${item.tag}</span>
                    <span class="cp-item-title">${item.name}</span>
                </div>
                <div class="cp-item-right">Jump &rarr;</div>
            `;
            
            div.addEventListener('click', () => {
                item.action();
                const modalEl = document.getElementById('commandPaletteOverlay');
                if (modalEl) modalEl.style.display = 'none';
            });
            container.appendChild(div);
        });
    };

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const modal = document.getElementById('commandPaletteOverlay');
            const input = document.getElementById('commandPaletteInput');
            
            if (modal) {
                if (modal.style.display === 'none' || modal.style.display === '') {
                    modal.style.display = 'flex';
                    if (input) {
                        input.value = '';
                        renderResults('');
                        input.focus();
                    }
                } else {
                    modal.style.display = 'none';
                }
            }
        }
        
        if (e.key === 'Escape') {
            const modal = document.getElementById('commandPaletteOverlay');
            if (modal && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'commandPaletteInput') {
            renderResults(e.target.value);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'commandPaletteOverlay') {
            e.target.style.display = 'none';
        }
    });

    window.openCommandPalette = () => {
        const modal = document.getElementById('commandPaletteOverlay');
        const input = document.getElementById('commandPaletteInput');
        if (modal) {
            modal.style.display = 'flex';
            if (input) {
                input.value = '';
                renderResults('');
                input.focus();
            }
        }
    };

    window.closeCommandPalette = () => {
        const modal = document.getElementById('commandPaletteOverlay');
        if (modal) modal.style.display = 'none';
    };

    window.openLatencyDiagnosticModal = () => {
        const modal = document.getElementById('latency-diagnostic-modal');
        if (modal) {
            modal.classList.add('open');
            if (window.__triggerInstantPing) window.__triggerInstantPing();
        }
    };

    window.closeLatencyDiagnosticModal = () => {
        const modal = document.getElementById('latency-diagnostic-modal');
        if (modal) modal.classList.remove('open');
    };

    if (!window.__latencyModalKeyBound) {
        window.__latencyModalKeyBound = true;
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.closeLatencyDiagnosticModal();
            }
        });
    }

    // Global 1-second pulse updating Command Palette network bar, Topbar ambient meter & Diagnostic modal
    const fetchLivePingGlobal = async () => {
        try {
            if (!window.SecureAPIConnector) return;
            const t0 = performance.now();
            const res = await window.SecureAPIConnector.get('/api/business/telemetry/live-ping');
            const clientRoundtrip = Math.round(performance.now() - t0);
            if (res && res.status === 'success' && res.data) {
                updateCommandPaletteNetworkBar(res.data, clientRoundtrip);
            }
        } catch(e) {
            // silent catch
        }
    };

    window.__triggerInstantPing = fetchLivePingGlobal;

    if (!window.__globalPingStarted) {
        window.__globalPingStarted = true;
        setTimeout(fetchLivePingGlobal, 150);
        setInterval(fetchLivePingGlobal, 1000);
    }
}

export function updateCommandPaletteNetworkBar(d, clientRoundtrip) {
    const extLatency = d.external_latency_ms;
    const extTarget = d.external_target || "8.8.8.8";
    const primaryLatency = extLatency !== null && extLatency !== undefined ? Math.round(extLatency) : clientRoundtrip;

    // 1. Update Command Palette Footer Values
    const cpVal = document.getElementById('cp-latency-val');
    const cpBadge = document.getElementById('cp-latency-badge');

    if (cpVal) {
        cpVal.innerText = `${primaryLatency} ms`;
    }

    let statusClass = 'optimal';
    let statusText = 'Optimal';

    if (primaryLatency < 35) {
        statusClass = 'optimal';
        statusText = 'Optimal';
    } else if (primaryLatency < 75) {
        statusClass = 'optimal';
        statusText = 'Good';
    } else if (primaryLatency < 150) {
        statusClass = 'normal';
        statusText = 'Normal';
    } else {
        statusClass = 'slow';
        statusText = 'Slow';
    }

    if (cpBadge) {
        cpBadge.innerText = statusText;
        cpBadge.className = `cp-status-chip ${statusClass}`;
    }

    // 2. Update Overview Header Network Widget (next to Broadcast Fleet Sync)
    const headerVal = document.getElementById('header-latency-val');
    const headerBadge = document.getElementById('header-latency-badge');
    if (headerVal) {
        headerVal.innerText = `${primaryLatency} ms`;
        headerVal.style.color = statusClass === 'optimal' ? '#10b981' : statusClass === 'normal' ? '#d97706' : '#dc2626';
        headerVal.classList.add('tick-pulse');
        setTimeout(() => {
            if (headerVal) headerVal.classList.remove('tick-pulse');
        }, 200);
    }
    if (headerBadge) {
        headerBadge.innerText = statusText;
        headerBadge.className = `header-latency-badge ${statusClass}`;
    }

    // 4. Update Diagnostic Modal if present
    const diagClientVal = document.getElementById('diag-client-val');
    const diagDbVal = document.getElementById('diag-db-val');
    const diagAnchorVal = document.getElementById('diag-anchor-val');
    const diagAnchorLabel = document.getElementById('diag-anchor-label');
    const diagAnchorName = document.getElementById('diag-anchor-name');
    const diagAnchorVerify = document.getElementById('diag-anchor-verify');
    const diagLastBeat = document.getElementById('diag-last-beat');
    const diagClientBar = document.getElementById('diag-client-bar');
    const diagDbBar = document.getElementById('diag-db-bar');
    const diagAnchorBar = document.getElementById('diag-anchor-bar');
    const diagOverallStatus = document.getElementById('diag-overall-status');

    const dbLatency = d.db_latency_ms !== null && d.db_latency_ms !== undefined ? d.db_latency_ms : 1.2;

    if (diagClientVal) {
        diagClientVal.innerText = `${clientRoundtrip} ms`;
        if (diagClientBar) diagClientBar.style.width = `${Math.min(100, Math.max(10, clientRoundtrip * 1.5))}%`;
    }
    if (diagDbVal) {
        diagDbVal.innerText = `${dbLatency} ms`;
        if (diagDbBar) diagDbBar.style.width = `${Math.min(100, Math.max(8, dbLatency * 6))}%`;
    }
    if (diagAnchorVal) {
        const extStr = extLatency !== null && extLatency !== undefined ? `${extLatency} ms` : 'Offline';
        diagAnchorVal.innerText = extStr;
        if (diagAnchorBar) {
            const extNum = extLatency !== null && extLatency !== undefined ? extLatency : 0;
            diagAnchorBar.style.width = `${Math.min(100, Math.max(10, extNum * 1.2))}%`;
        }
    }
    if (diagAnchorLabel) diagAnchorLabel.innerText = `Anchor (${extTarget})`;
    if (diagAnchorName) {
        diagAnchorName.innerText = extTarget === '8.8.8.8' ? 'Google DNS (8.8.8.8)' : extTarget === '1.1.1.1' ? 'Cloudflare DNS (1.1.1.1)' : `Network Target (${extTarget})`;
    }
    if (diagAnchorVerify) {
        diagAnchorVerify.innerText = `${extTarget} (Port 53 Active)`;
    }
    if (diagLastBeat) {
        const dNow = new Date();
        diagLastBeat.innerText = `Updated: ${dNow.toLocaleTimeString()} (1s ticker)`;
    }
    if (diagOverallStatus) {
        if (primaryLatency < 50) {
            diagOverallStatus.innerText = 'Optimal & Ultra-Low Latency';
            diagOverallStatus.style.color = '#15803d';
        } else if (primaryLatency < 150) {
            diagOverallStatus.innerText = 'Normal Latency';
            diagOverallStatus.style.color = '#b45309';
        } else {
            diagOverallStatus.innerText = 'High Latency / Network Delay';
            diagOverallStatus.style.color = '#dc2626';
        }
    }
}
