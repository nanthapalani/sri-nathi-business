import { getDB } from '/shared/db.js?v=14';
import { formatINR, formatDateTime, getIcons } from '../utils.js';

export const renderOverviewTab = () => {
    const db = getDB();
    const icons = getIcons();
    
    const employees = db.employees || [];
    const menu = db.menu || [];
    const units = db.units || [];
    const logs = db.audit_logs || db.auditLogs || [];
    
    const lockedDevices = employees.filter(e => e.allowedDeviceId || e.allowed_device_id).length;
    const sys = window.systemStatus || {};
    const isOperational = sys.status === 'OPERATIONAL' || sys.status === 'ok' || !sys.status;

    return `
        <div class="content-wrapper">
            <!-- Page Header -->
            <div class="page-header-block">
                <div class="page-title-text">
                    <h1>Executive Administration Overview</h1>
                    <p>Enterprise system summary, master catalog statistics, and operational management modules.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-secondary" onclick="window.openCommandPalette()">
                        <kbd style="font-family: monospace; font-size: 11px; margin-right: 4px;">⌘K</kbd> Quick Actions
                    </button>
                    <button class="btn btn-primary" onclick="window.navigateTab('pos')">
                        ${icons.pos} Product Catalog
                    </button>
                </div>
            </div>

            <!-- 1. Top Enterprise Metrics Strip (Google & Bitwarden style) -->
            <div class="metrics-strip">
                <div class="metric-strip-item">
                    <div class="monogram-badge badge-blue">${icons.pos}</div>
                    <div>
                        <div class="metric-strip-val">${menu.length}</div>
                        <div class="metric-strip-label">Active Catalog Products</div>
                    </div>
                </div>

                <div class="metric-strip-item">
                    <div class="monogram-badge badge-green">${icons.branch}</div>
                    <div>
                        <div class="metric-strip-val">${units.length} Units</div>
                        <div class="metric-strip-label">Operational Locations</div>
                    </div>
                </div>

                <div class="metric-strip-item">
                    <div class="monogram-badge badge-purple">${icons.users}</div>
                    <div>
                        <div class="metric-strip-val">${employees.length} Personnel</div>
                        <div class="metric-strip-label">${lockedDevices} Bound POS Devices</div>
                    </div>
                </div>

                <div class="metric-strip-item">
                    <div class="monogram-badge badge-orange">${icons.activity}</div>
                    <div>
                        <div class="metric-strip-val" style="color: #16a34a; font-size: 17px;">
                            ${isOperational ? 'Optimal' : 'Attention'}
                        </div>
                        <div class="metric-strip-label">System Reliability</div>
                    </div>
                </div>
            </div>

            <!-- 2. Meta Business Manager Style Structured Sections (Spacious & Clean) -->
            <div style="display: grid; grid-template-columns: 1fr 380px; gap: 32px; align-items: start;">
                <!-- Left: Enterprise Master Management Modules -->
                <div style="display: flex; flex-direction: column; gap: 32px;">
                    <!-- Master Control Center Section -->
                    <div class="meta-section-card">
                        <div class="meta-section-header">
                            <h2>Master Management Modules</h2>
                            <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">Direct Cloud Sync Active</span>
                        </div>
                        <div class="meta-section-body">
                            <div class="property-row">
                                <div>
                                    <div class="property-label">Bulk Price Adjustment</div>
                                    <div class="property-desc">Update category pricing across branches and digital channels.</div>
                                </div>
                                <div class="property-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('pos'); setTimeout(window.openBulkPriceModal, 150);">
                                        Configure
                                    </button>
                                </div>
                            </div>

                            <div class="property-row">
                                <div>
                                    <div class="property-label">Business Locations & Branches</div>
                                    <div class="property-desc">Configure branch coordinates, GSTIN, FSSAI licenses, and tables.</div>
                                </div>
                                <div class="property-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('branches'); setTimeout(() => window.openBranchModal('add'), 150);">
                                        Manage
                                    </button>
                                </div>
                            </div>

                            <div class="property-row">
                                <div>
                                    <div class="property-label">Master Data Explorer</div>
                                    <div class="property-desc">Browse and manage master enterprise records across 13+ ledgers.</div>
                                </div>
                                <div class="property-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('data_studio');">
                                        Open Explorer
                                    </button>
                                </div>
                            </div>

                            <div class="property-row">
                                <div>
                                    <div class="property-label">Tax & Invoicing Policies</div>
                                    <div class="property-desc">Configure GST slabs, rounding thresholds, and invoice formulas.</div>
                                </div>
                                <div class="property-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('billing_rules');">
                                        Configure
                                    </button>
                                </div>
                            </div>

                            <div class="property-row">
                                <div>
                                    <div class="property-label">Connected Services & Gateways</div>
                                    <div class="property-desc">Payment terminals, cloud archive backup, and email notification webhooks.</div>
                                </div>
                                <div class="property-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('integrations');">
                                        Manage
                                    </button>
                                </div>
                            </div>

                            <div class="property-row">
                                <div>
                                    <div class="property-label">Archive Snapshot Generator</div>
                                    <div class="property-desc">Generate cryptographically verified cloud snapshots for disaster recovery.</div>
                                </div>
                                <div class="property-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('infrastructure'); setTimeout(window.triggerLiveBackup, 150);">
                                        Create Backup
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Fast-Access Product Catalog Table (Bitwarden style) -->
                    <div class="meta-section-card">
                        <div class="meta-section-header">
                            <h2>Catalog Quick Access</h2>
                            <button class="btn btn-sm btn-secondary" onclick="window.navigateTab('pos')">View Full Catalog →</button>
                        </div>
                        <table class="corp-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Product Name</th>
                                    <th>Category</th>
                                    <th>Price</th>
                                    <th style="text-align: center;">POS Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${menu.slice(0, 5).map(m => `
                                    <tr>
                                        <td>
                                            <div class="monogram-badge badge-slate" style="font-size: 11px;">
                                                ${(m.name || 'IT').substring(0, 2).toUpperCase()}
                                            </div>
                                        </td>
                                        <td style="font-weight: 600; color: #1e293b;">${m.name}</td>
                                        <td><span style="background: var(--bg-surface-secondary); padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 500;">${m.category || 'General'}</span></td>
                                        <td style="font-weight: 700; color: #1e293b;">${formatINR(m.price || 0)}</td>
                                        <td style="text-align: center;">
                                            <label class="toggle-switch">
                                                <input type="checkbox" ${m.active !== false ? 'checked' : ''} onchange="window.toggleMenuChannel('${m.id}', 'active', this.checked)">
                                                <span class="toggle-slider"></span>
                                            </label>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Right: Real-time Operational Stream Drawer -->
                <div class="meta-section-card">
                    <div class="meta-section-header">
                        <h2>Live Operations Stream</h2>
                        <span class="system-pulse-pill"><span class="pulse-indicator"></span> Real-Time</span>
                    </div>
                    <div style="padding: 12px 16px; display: flex; flex-direction: column; max-height: 480px; overflow-y: auto;">
                        ${logs.length === 0 ? `
                            <div style="padding: 12px 0; border-bottom: 1px solid var(--border-light); display: flex; gap: 10px; font-size: 12.5px;">
                                <div style="width: 7px; height: 7px; border-radius: 50%; background: var(--accent); margin-top: 6px; flex-shrink: 0;"></div>
                                <div>
                                    <div style="font-weight: 600; color: #1e293b;">System Initialized</div>
                                    <div style="color: var(--text-muted); font-size: 12px;">Operational services connected.</div>
                                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Just now</div>
                                </div>
                            </div>
                        ` : logs.slice(0, 8).map(log => `
                            <div style="padding: 12px 0; border-bottom: 1px solid var(--border-light); display: flex; gap: 10px; font-size: 12.5px;">
                                <div style="width: 7px; height: 7px; border-radius: 50%; background: var(--accent); margin-top: 6px; flex-shrink: 0;"></div>
                                <div>
                                    <div style="font-weight: 600; color: #1e293b;">${log.action || log.event_type || 'TRANSACTION'}</div>
                                    <div style="color: var(--text-secondary); font-size: 12px; margin-top: 1px;">${log.details || log.description || log.message || '-'}</div>
                                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${formatDateTime(log.timestamp || log.created_at)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="padding: 14px 16px; border-top: 1px solid var(--border-light); text-align: center;">
                        <button class="btn btn-sm btn-secondary" style="width: 100%;" onclick="window.navigateTab('activity')">
                            Full Audit Log History
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};
