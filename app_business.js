import { getDB, saveDB, SecureAPIConnector, logAudit } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading, formatINR, formatDateTime, showSuccessOverlay } from './utils.js';
import { initAuth } from './auth.js';
import { initSync, syncBackend } from './sync.js';

// Module Tab Imports
import { renderOverviewTab } from './tabs/overview.js';
import { renderPosTab } from './tabs/pos.js';
import { renderBranchesTab } from './tabs/branches.js';
import { renderBillingRulesTab } from './tabs/billing_rules.js';
import { renderDataStudioTab } from './tabs/data_studio.js';
import { renderAccessTab } from './tabs/access.js';
import { renderIntegrationsTab } from './tabs/integrations.js';
import { renderBrandingTab } from './tabs/branding.js';
import { renderActivityTab } from './tabs/activity.js';
import { renderInfrastructureTab } from './tabs/infrastructure.js';
import { renderArchiveTab } from './tabs/archive.js';

window.currentTab = 'overview';
window.searchQuery = '';
window.posCategoryFilter = 'All';

const tabTitles = {
    overview: 'Executive Administration Overview',
    pos: 'Product Catalog & Pricing Management',
    branches: 'Business Locations & Operational Units',
    billing_rules: 'Tax & Invoicing Policies',
    data_studio: 'Master Data Explorer',
    access: 'User Roles & Access Permissions',
    integrations: 'Connected Services & Payment Gateways',
    branding: 'Corporate Brand & Legal Profile',
    activity: 'System Audit & Activity Trail',
    infrastructure: 'System Administration & Reliability Studio',
    archive: 'Data Archive & Recycle Bin'
};

export const navigateTab = (tabName) => {
    window.currentTab = tabName;
    window.searchQuery = '';
    render();
    if (tabName === 'data_studio' && window.fetchStudioTable) {
        window.fetchStudioTable(window.activeStudioTable || 'invoices');
    }
};
window.navigateTab = navigateTab;

export const setSearchQuery = (query) => {
    window.searchQuery = query;
    if (window.renderTabContentDOM) window.renderTabContentDOM();
};
window.setSearchQuery = setSearchQuery;

const renderTabContent = () => {
    switch (window.currentTab) {
        case 'overview': return renderOverviewTab();
        case 'pos': return renderPosTab();
        case 'branches': return renderBranchesTab();
        case 'billing_rules': return renderBillingRulesTab();
        case 'data_studio': return renderDataStudioTab();
        case 'access': return renderAccessTab();
        case 'integrations': return renderIntegrationsTab();
        case 'branding': return renderBrandingTab();
        case 'activity': return renderActivityTab();
        case 'infrastructure': return renderInfrastructureTab();
        case 'archive': return renderArchiveTab();
        default: return renderOverviewTab();
    }
};

export const closeModal = () => {
    const modalEl = document.getElementById('business-modal');
    if (modalEl) modalEl.classList.remove('open');
    const cp = document.getElementById('command-palette-modal');
    if (cp) cp.classList.remove('open');
};
window.closeModal = closeModal;

export const openModal = (type, mode = 'add', data = null) => {
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        modalEl.onclick = (e) => {
            if (e.target === modalEl) window.closeModal();
        };
        document.body.appendChild(modalEl);
    }

    let title = 'Record Editor';
    let bodyHTML = '';
    let saveFunc = '';

    if (type === 'menu') {
        title = mode === 'add' ? 'Add Product Item' : 'Edit Product Item';
        const item = data || {};
        bodyHTML = `
            <div class="form-group" style="margin-bottom: 14px;">
                <label class="form-label">Product Name *</label>
                <input type="text" id="modal-menu-name" class="form-input" value="${item.name || ''}" placeholder="e.g. Masala Dosa">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group">
                    <label class="form-label">Category *</label>
                    <select id="modal-menu-category" class="form-select">
                        <option value="Tiffins" ${item.category === 'Tiffins' ? 'selected' : ''}>Tiffins</option>
                        <option value="Meals" ${item.category === 'Meals' ? 'selected' : ''}>Meals</option>
                        <option value="Beverages" ${item.category === 'Beverages' ? 'selected' : ''}>Beverages</option>
                        <option value="Snacks" ${item.category === 'Snacks' ? 'selected' : ''}>Snacks</option>
                        <option value="Desserts" ${item.category === 'Desserts' ? 'selected' : ''}>Desserts</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Unit Price (₹) *</label>
                    <input type="number" id="modal-menu-price" class="form-input" value="${item.price || ''}" placeholder="0.00" step="1">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group">
                    <label class="form-label">GST Tax Rate (%)</label>
                    <input type="number" id="modal-menu-gst" class="form-input" value="${item.gstRate || item.gst_rate || 5}" step="0.5">
                </div>
                <div class="form-group">
                    <label class="form-label">Item Code (Numerical Only) *</label>
                    <input type="text" id="modal-menu-code" class="form-input" value="${item.itemCode || item.item_number || item.id || ''}" placeholder="e.g. 1001" oninput="window.validateItemCode(this.value, '${item.id || ''}')">
                    <div id="modal-menu-code-msg" style="font-size: 11px; margin-top: 4px; color: #64748b;">Code must be strictly numbers.</div>
                </div>
            </div>
        `;
        saveFunc = `window.saveMenuItemModal('${mode}', '${item.id || ''}')`;
    }

    modalEl.innerHTML = `
        <div class="modal-card" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="window.closeModal()" title="Close dialog">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                ${bodyHTML}
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="${saveFunc}">Save Record</button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};
window.openModal = openModal;

window.validateItemCode = async (code, excludeId) => {
    const msgEl = document.getElementById('modal-menu-code-msg');
    if (!msgEl) return;
    
    if (!code) {
        msgEl.innerText = 'Item code is required.';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    if (!/^\d+$/.test(code)) {
        msgEl.innerText = 'Code must be strictly numerical.';
        msgEl.style.color = '#ef4444';
        return;
    }
    
    msgEl.innerText = 'Checking availability...';
    msgEl.style.color = '#64748b';
    
    try {
        const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
        const url = `/api/validate-code?code=${encodeURIComponent(code)}${excludeId ? '&exclude_id=' + encodeURIComponent(excludeId) : ''}`;
        const res = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        
        if (data.valid) {
            msgEl.innerText = '✓ ' + data.message;
            msgEl.style.color = '#10b981';
        } else {
            msgEl.innerText = '✗ ' + data.message;
            msgEl.style.color = '#ef4444';
        }
    } catch (e) {
        msgEl.innerText = 'Validation failed.';
        msgEl.style.color = '#ef4444';
    }
};

window.saveMenuItemModal = async (mode, existingId) => {
    const name = document.getElementById('modal-menu-name').value.trim();
    const category = document.getElementById('modal-menu-category').value;
    const price = parseFloat(document.getElementById('modal-menu-price').value || 0);
    const gstRate = parseFloat(document.getElementById('modal-menu-gst').value || 5);
    const itemCode = document.getElementById('modal-menu-code').value.trim();

    if (!name || price <= 0) {
        showToast('Please enter a valid product name and price', 'error');
        return;
    }
    
    if (!itemCode || !/^\d+$/.test(itemCode)) {
        showToast('Item Code is required and must be strictly numerical.', 'error');
        return;
    }

    const id = mode === 'add' ? `item-${Date.now()}` : existingId;
    const itemData = {
        id,
        name,
        category,
        price,
        gstRate,
        gst_rate: gstRate,
        itemCode: itemCode || id,
        item_number: itemCode || id,
        active: true,
        isAvailableSwiggy: true,
        isAvailableZomato: true,
        unitId: 'unit-1'
    };

    showLoading('Saving product item in database...');
    try {
        const db = getDB();
        db.menu = db.menu || [];
        const idx = db.menu.findIndex(m => m.id === id);
        if (idx >= 0) db.menu[idx] = { ...db.menu[idx], ...itemData };
        else db.menu.push(itemData);

        await SecureAPIConnector.upsert('menu', id, itemData);
        await saveDB(db);
        window.closeModal();
        showSuccessOverlay('Product item saved successfully');
    } catch (e) {
        showToast('Failed to save product item', 'error');
    } finally {
        hideLoading();
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    }
};

export const renderTabContentDOM = () => {
    const mainEl = document.getElementById('main-content-view');
    if (mainEl) {
        mainEl.innerHTML = renderTabContent();
    }
};
window.renderTabContentDOM = renderTabContentDOM;

export const render = () => {
    const root = document.getElementById('app');
    const icons = getIcons();
    const activeTitle = tabTitles[window.currentTab] || 'Executive Administration Overview';

    root.innerHTML = `
        <div class="portal-layout">
            <!-- Top Enterprise App Bar (Google & Bitwarden style) -->
            <header class="portal-topbar">
                <div class="topbar-left">
                    <div class="brand-badge-lockup" onclick="window.navigateTab('overview')">
                        <div class="brand-icon-square">SN</div>
                        <div class="brand-title-text">Sri Nathi Enterprise Portal</div>
                        <span class="brand-tag-pill">PORTAL</span>
                    </div>

                    <div class="location-dropdown-pill" onclick="window.navigateTab('branches')">
                        <span>All Business Locations</span>
                        <span style="font-size: 10px; color: var(--text-muted);">▾</span>
                    </div>
                </div>

                <div class="topbar-right">
                    <button class="search-bar-trigger" onclick="window.openCommandPalette()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span style="flex: 1; text-align: left;">Search workspace...</span>
                        <kbd style="background: white; border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-size: 10px; font-family: monospace; font-weight: 600;">⌘K</kbd>
                    </button>

                    <div class="system-pulse-pill">
                        <span class="pulse-indicator"></span>
                        <span>Operational</span>
                    </div>

                    <div class="user-avatar-pill" title="Executive Administrator">
                        SN
                    </div>

                    <button class="topbar-btn" title="Lock Console Screen" onclick="window.sessionGuard && window.sessionGuard.lockScreen()" style="background: none; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--text-secondary);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <span>Lock</span>
                    </button>

                    <button class="topbar-btn" title="Sign Out" onclick="window.handleConsoleSignOut()" style="background: none; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: #ef4444;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            <!-- Main Portal Body: Left Sidebar + Content Area -->
            <div class="portal-body">
                <!-- Enterprise Left Sidebar (Bitwarden & Meta style) -->
                <aside class="portal-sidebar">
                    <div class="sidebar-nav-list">
                        <div class="sidebar-item ${window.currentTab === 'overview' ? 'active' : ''}" onclick="window.navigateTab('overview')">
                            <div class="sidebar-item-icon">${icons.overview}</div>
                            <span>Overview</span>
                        </div>

                        <div class="sidebar-group-title">Core Master Data</div>

                        <div class="sidebar-item ${window.currentTab === 'pos' ? 'active' : ''}" onclick="window.navigateTab('pos')">
                            <div class="sidebar-item-icon">${icons.pos}</div>
                            <span>Catalog & Pricing</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'branches' ? 'active' : ''}" onclick="window.navigateTab('branches')">
                            <div class="sidebar-item-icon">${icons.branch}</div>
                            <span>Business Locations</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'billing_rules' ? 'active' : ''}" onclick="window.navigateTab('billing_rules')">
                            <div class="sidebar-item-icon">${icons.billing}</div>
                            <span>Tax & Billing Policies</span>
                        </div>

                        <div class="sidebar-group-title">Governance & Data</div>

                        <div class="sidebar-item ${window.currentTab === 'data_studio' ? 'active' : ''}" onclick="window.navigateTab('data_studio')">
                            <div class="sidebar-item-icon">${icons.dataStudio}</div>
                            <span>Master Data Explorer</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'access' ? 'active' : ''}" onclick="window.navigateTab('access')">
                            <div class="sidebar-item-icon">${icons.access}</div>
                            <span>User Roles & Permissions</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'integrations' ? 'active' : ''}" onclick="window.navigateTab('integrations')">
                            <div class="sidebar-item-icon">${icons.integrations}</div>
                            <span>Connected Services</span>
                        </div>

                        <div class="sidebar-group-title">Administration</div>

                        <div class="sidebar-item ${window.currentTab === 'branding' ? 'active' : ''}" onclick="window.navigateTab('branding')">
                            <div class="sidebar-item-icon">${icons.branding}</div>
                            <span>Brand & Profile</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'activity' ? 'active' : ''}" onclick="window.navigateTab('activity')">
                            <div class="sidebar-item-icon">${icons.activity}</div>
                            <span>Audit Trail</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'infrastructure' ? 'active' : ''}" onclick="window.navigateTab('infrastructure')">
                            <div class="sidebar-item-icon">${icons.infrastructure}</div>
                            <span>System Reliability</span>
                        </div>
                        <div class="sidebar-item ${window.currentTab === 'archive' ? 'active' : ''}" onclick="window.navigateTab('archive')">
                            <div class="sidebar-item-icon">${icons.archive || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'}</div>
                            <span>Data Archive</span>
                        </div>
                    </div>

                    <div class="sidebar-footer-area">
                        <button class="sidebar-sync-btn" onclick="window.syncBackend()">
                            ${icons.refresh} Synchronize Data
                        </button>
                    </div>
                </aside>

                <!-- Main Content Workspace Area -->
                <main class="portal-main">
                    <div id="main-content-view">
                        ${renderTabContent()}
                    </div>
                </main>
            </div>
        </div>
    `;
};

// ==========================================
// SPOTLIGHT SEARCH (RAYCAST / LINEAR STYLE)
// ==========================================
window.openCommandPalette = () => {
    let cp = document.getElementById('command-palette-modal');
    if (!cp) {
        cp = document.createElement('div');
        cp.id = 'command-palette-modal';
        cp.className = 'modal-overlay';
        cp.onclick = (e) => {
            if (e.target === cp) window.closeModal();
        };
        document.body.appendChild(cp);
    }

    const commands = [
        { label: 'Bulk Price Adjustment Calculator', category: 'Catalog', action: "window.closeModal(); window.navigateTab('pos'); setTimeout(window.openBulkPriceModal, 150);" },
        { label: 'Add New Product Item', category: 'Catalog', action: "window.closeModal(); window.navigateTab('pos'); setTimeout(() => window.openModal('menu', 'add'), 150);" },
        { label: 'Add Business Location / Branch', category: 'Operations', action: "window.closeModal(); window.navigateTab('branches'); setTimeout(() => window.openBranchModal('add'), 150);" },
        { label: 'Explore Invoices Master Ledger', category: 'Ledger', action: "window.closeModal(); window.navigateTab('data_studio'); setTimeout(() => window.selectStudioTable('invoices'), 150);" },
        { label: 'Explore Staff & Personnel Ledger', category: 'Personnel', action: "window.closeModal(); window.navigateTab('data_studio'); setTimeout(() => window.selectStudioTable('employees'), 150);" },
        { label: 'Configure Tax & Invoice Formulas', category: 'Billing', action: "window.closeModal(); window.navigateTab('billing_rules');" },
        { label: 'Test Payment Terminal Gateway', category: 'Services', action: "window.closeModal(); window.navigateTab('integrations'); setTimeout(() => window.testIntegrationPing('pine-labs'), 150);" },
        { label: 'Generate Verified Archive Snapshot', category: 'Reliability', action: "window.closeModal(); window.navigateTab('infrastructure'); setTimeout(window.triggerLiveBackup, 150);" },
        { label: 'View System Audit Trail', category: 'Audit', action: "window.closeModal(); window.navigateTab('activity');" }
    ];

    cp.innerHTML = `
        <div class="modal-card" style="max-width: 580px; margin-top: -100px;" onclick="event.stopPropagation()">
            <div class="cp-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="cp-search-input" class="form-input" style="border: none; padding: 4px 0; font-size: 15px; box-shadow: none; flex: 1;" placeholder="Search workspace actions, tables, or configurations..." oninput="window.filterCommandPalette(this.value)">
                
                <!-- Circular Crossmark Close Button -->
                <button class="cp-close-btn" onclick="window.closeModal()" title="Close search (or click blank space)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div id="cp-results-list" style="max-height: 340px; overflow-y: auto; padding: 10px;">
                ${commands.map(cmd => `
                    <div style="padding: 10px 14px; border-radius: 8px; font-size: 13.5px; font-weight: 500; color: #0f172a; cursor: pointer; transition: all 0.12s var(--ease-spring); display: flex; align-items: center; justify-content: space-between;" 
                         onmouseover="this.style.background='#f1f5f9'; this.style.transform='translateX(3px)';" onmouseout="this.style.background='transparent'; this.style.transform='none';"
                         onclick="${cmd.action}">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">${cmd.category}</span>
                            <span>${cmd.label}</span>
                        </div>
                        <span style="font-size: 12px; color: var(--accent); font-weight: 600;">Jump →</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    cp.classList.add('open');
    setTimeout(() => {
        const inp = document.getElementById('cp-search-input');
        if (inp) inp.focus();
    }, 50);
};

window.filterCommandPalette = (q) => {
    const list = document.getElementById('cp-results-list');
    if (!list) return;
    const query = q.toLowerCase();
    const items = list.querySelectorAll('div[onclick]');
    items.forEach(it => {
        const text = it.innerText.toLowerCase();
        it.style.display = text.includes(query) ? 'flex' : 'none';
    });
};

// Keyboard listener for Cmd+K / Ctrl+K / ESC
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        window.openCommandPalette();
    } else if (e.key === 'Escape') {
        window.closeModal();
    }
});

window.handleConsoleSignOut = () => {
    const keys = [
        'sri_nathi_session_user',
        'sri_nathi_jwt_token',
        'sri_nathi_session_token',
        'sri_nathi_token',
        'sri_nathi_session_locked',
        'sri_nathi_last_activity'
    ];
    keys.forEach(k => {
        try { localStorage.removeItem(k); } catch(e) {}
        try { sessionStorage.removeItem(k); } catch(e) {}
        try { if (window.SecureStorage) window.SecureStorage.removeItem(k); } catch(e) {}
    });
    try { sessionStorage.clear(); } catch(e) {}
    window.location.replace('/');
};

// ==========================================
// BOOTSTRAP INITIALIZATION
// ==========================================
const initApp = async () => {
    initAuth(async () => {
        initSync();
        
        try {
            const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
            const res = await fetch('/api/system/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                window.systemStatus = await res.json();
            }
        } catch (e) {}

        render();
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}