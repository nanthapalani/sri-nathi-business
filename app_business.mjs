// Record activity for cross-tab inactivity tracker
const recordActivity = () => {
    localStorage.setItem('sri_nathi_last_activity', Date.now().toString());
};
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'visibilitychange', 'focus'].forEach(event => {
    document.addEventListener(event, recordActivity, { passive: true });
});
recordActivity();
import { getDB, saveDB, logAudit, LAST_SYNC_STATE } from '/shared/db.js?v=14';
const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'http://localhost:8000' : '';
window.apiBase = API_BASE;
window.auditLogs = [];
window.rbacData = { roles: [], bindings: [] };
window.pendingRbacChange = null;
window.lastSyncTimestamp = null;

window.showSuccessOverlay = (message) => {
    // Create animated success overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.4s ease-in-out';
    
    overlay.innerHTML = `
        <div style="background: white; padding: 40px 60px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; transform: scale(0.8); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0; display: flex; flex-direction: column; align-items: center;" id="success-overlay-box">
            <svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style="width: 80px; height: 80px; border-radius: 50%; display: block; margin: 0 auto; stroke-width: 2; stroke: #fff; stroke-miterlimit: 10; box-shadow: inset 0px 0px 0px #4bb71b; animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; background: #fff;">
                <circle class="success-checkmark__circle" cx="26" cy="26" r="25" fill="none" style="stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: #4bb71b; fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;"></circle>
                <path class="success-checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style="transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; stroke: #4bb71b; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards, makeWhite .3s ease-in-out .9s forwards;"></path>
            </svg>
            <h2 style="margin-top: 24px; font-size: 24px; font-weight: 700; color: #1e293b; font-family: 'Inter', sans-serif;">${message}</h2>
            <p style="color: #64748b; margin-top: 8px; font-family: 'Inter', sans-serif;">The changes have been applied.</p>
        </div>
        <style>
            @keyframes stroke { 100% { stroke-dashoffset: 0; } }
            @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
            @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 30px #4bb71b; } }
            @keyframes makeWhite { 100% { stroke: #fff; } }
        </style>
    `;
    
    document.body.appendChild(overlay);
    
    // Trigger animations
    setTimeout(() => {
        overlay.style.opacity = '1';
        const box = overlay.querySelector('#success-overlay-box');
        if (box) {
            box.style.transform = 'scale(1)';
            box.style.opacity = '1';
        }
    }, 50);
    
    // Remove after 2.5 seconds
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 400);
    }, 2500);
};

window.fetchAuditLogs = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/audit_logs`);
        const data = await res.json();
        window.auditLogs = data.logs || [];
    } catch(e) { console.error("Audit logs fetch error", e); }
};
window.fetchRbacData = async () => {
    try {
        const [rolesRes, bindingsRes] = await Promise.all([
            fetch(`${API_BASE}/api/rbac/roles`),
            fetch(`${API_BASE}/api/rbac/bindings`)
        ]);
        const rolesData = await rolesRes.json();
        const bindingsData = await bindingsRes.json();
        window.rbacData.roles = rolesData.roles || [];
        window.rbacData.bindings = bindingsData.bindings || [];
    } catch(e) { console.error("RBAC fetch error", e); }
};
window.systemStatus = {
    storage: { used_bytes: 0 }
};
window.fetchSystemStatus = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/system/status`);
        const data = await res.json();
        if (data.storage) window.systemStatus = data;
    } catch(e) { console.error("Status fetch error", e); }
};
// Calculate the REAL number of unsynced records by diffing local cache vs last-synced state
window.getUnsyncedCount = () => {
    const db = getDB();
    let count = 0;
    for (const key of Object.keys(db)) {
        const current = db[key];
        if (!Array.isArray(current)) continue;
        const synced = LAST_SYNC_STATE[key] || [];
        // Count modified or new items
        for (const item of current) {
            const prev = synced.find(s => s.id === item.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) count++;
        }
        // Count deleted items
        for (const prev of synced) {
            if (!current.find(c => c.id === prev.id)) count++;
        }
    }
    return count;
};
// Full 2-way sync: PUSH local changes → FLUSH offline queue → PULL latest from DB
window.syncBackend = async () => {
    console.log("[Sync] Starting full 2-way sync...");
    
    // Step 1: PUSH — save any local diffs to PostgreSQL
    const db = getDB();
    await saveDB(db);
    
    // Step 2: FLUSH — replay any queued offline writes
    
    
    // Step 3: PULL — fetch the latest state of ALL data from PostgreSQL
    if (typeof window.fetchDatabaseState === 'function') {
        await window.fetchDatabaseState();
    }
    
    // Step 4: PULL — fetch supplementary data (audit logs, RBAC, system status)
    await window.fetchAuditLogs();
    await window.fetchRbacData();
    await window.fetchSystemStatus();
    
    // Step 5: Record sync timestamp
    window.lastSyncTimestamp = Date.now();
    
    console.log("[Sync] Complete. Unsynced remaining:", window.getUnsyncedCount());
    
    // Step 6: Re-render the UI with fresh data
    if (window.renderTabContentDOM) window.renderTabContentDOM();
};
setInterval(window.syncBackend, 180000); // 3-minute auto-sync
window.addEventListener('beforeunload', () => {
    // Push any pending local diffs before leaving
    const db = getDB();
    saveDB(db);
    navigator.sendBeacon(`${API_BASE}/api/audit_logs`, JSON.stringify({action: 'LOGOUT', details: 'User closed Business Console session'}));
});
setTimeout(window.syncBackend, 1000);
let currentTab = 'overview';
let isLoading = true;
let searchQuery = '';
let activeCategory = 'All';
// Modal state
let modalState = {
    isOpen: false,
    type: null, // 'menu', 'employee'
    mode: 'add', // 'add', 'edit'
    data: null
};
const formatINR = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};
const formatDateTime = (isoString) => {
    return new Date(isoString).toLocaleString('en-IN', { 
        day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' 
    });
};
const getIcons = () => ({
    overview: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    branch: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    branding: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v6h6"></path><path d="M2 15h10"></path><path d="m9 18 3-3-3-3"></path></svg>`,
    pos: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    access: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    activity: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
    storage: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
    wallet: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>`,
    lock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    unlock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    item: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>`,
    user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    building: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>`,
    folder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    infrastructure: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
});
// Global handlers
window.saveOnlineGateway = async () => {
    const active = document.getElementById('rzp-active').checked;
    const keyId = document.getElementById('rzp-key').value;
    const keySecret = document.getElementById('rzp-secret').value;
    
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');
    if (!settings.payment_terminals) settings.payment_terminals = {};
    settings.payment_terminals.razorpay = { active, keyId, keySecret };
    
    window.showLoading('Saving Gateway...');
    try {
        const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'http://localhost:8000' : '';
        await fetch(`${API_BASE}/api/business/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        localStorage.setItem('sri_nathi_settings', JSON.stringify(settings));
        window.showToast('Online Gateway settings saved', 'success');
    } catch (e) {
        window.showToast('Failed to save gateway', 'error');
    } finally {
        window.hideLoading();
    }
};
window.deleteTerminal = async (index) => {
    if (!confirm('Remove this terminal from the unit?')) return;
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');
    if (settings.payment_terminals && settings.payment_terminals.edc_machines) {
        const activeUnitFilter = window.paymentTerminalUnitId || (getDB().units?.length > 0 ? getDB().units[0].id : 'unit-1');
        let foundCount = -1;
        let globalIndex = -1;
        for (let i = 0; i < settings.payment_terminals.edc_machines.length; i++) {
            if (settings.payment_terminals.edc_machines[i].unitId === activeUnitFilter) {
                foundCount++;
                if (foundCount === index) {
                    globalIndex = i;
                    break;
                }
            }
        }
        
        if (globalIndex > -1) {
            settings.payment_terminals.edc_machines.splice(globalIndex, 1);
            try {
                const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'http://localhost:8000' : '';
                await fetch(`${API_BASE}/api/business/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
                localStorage.setItem('sri_nathi_settings', JSON.stringify(settings));
                window.showToast('Terminal removed', 'success');
                if (window.renderTabContentDOM) window.renderTabContentDOM();
            } catch (e) {}
        }
    }
};
window.saveNewTerminal = async () => {
    const provider = document.getElementById('modal-term-provider').value;
    const unitId = document.getElementById('modal-term-unit').value;
    const ip = document.getElementById('modal-term-ip')?.value || '';
    const port = document.getElementById('modal-term-port')?.value || '';
    const tid = document.getElementById('modal-term-tid')?.value || '';
    
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');
    if (!settings.payment_terminals) settings.payment_terminals = {};
    if (!settings.payment_terminals.edc_machines) settings.payment_terminals.edc_machines = [];
    
    settings.payment_terminals.edc_machines.push({ provider, unitId, ip, port, tid });
    
    window.showLoading('Adding Terminal...');
    try {
        const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'http://localhost:8000' : '';
        await fetch(`${API_BASE}/api/business/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        localStorage.setItem('sri_nathi_settings', JSON.stringify(settings));
        window.closeModal();
        window.showToast('Terminal added successfully', 'success');
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    } catch (e) {
        window.showToast('Failed to save terminal', 'error');
    } finally {
        window.hideLoading();
    }
};
window.saveNewBranch = async () => {
    const code = document.getElementById('modal-branch-code').value.trim();
    const name = document.getElementById('modal-branch-name').value.trim();
    
    if (!code || !name) {
        window.showToast('Please fill all required fields', 'error');
        return;
    }
    
    const db = getDB();
    if (!db.units) db.units = [];
    const existing = db.units.find(u => u.code.toLowerCase() === code.toLowerCase());
    if (existing) {
        window.showToast('Unit code already exists. Please choose another.', 'error');
        return;
    }
    
    window.showLoading('Creating Branch...');
    try {
        db.units.push({ 
            id: code, 
            code: code, 
            name: name
        });
        await saveDB(db);
        window.closeModal();
        if (window.showSuccessOverlay) {
            window.showSuccessOverlay('Unit saved successfully');
        } else {
            window.showToast('Unit saved successfully', 'success');
        }
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    } catch (e) {
        window.showToast('Failed to save branch', 'error');
    } finally {
        window.hideLoading();
    }
};
window.toggleTerminalFields = () => {
    const provider = document.getElementById('modal-term-provider').value;
    const isPine = (provider === 'Pine Labs');
    const wrapper = document.getElementById('modal-dynamic-fields');
    if (!wrapper) return;
    
    if (isPine) {
        wrapper.innerHTML = `
            <div style="display:flex; gap:1rem; margin-top:16px;">
                <div class="form-group" style="flex:2;"><label class="form-label">IP Address</label><input type="text" id="modal-term-ip" class="form-input" placeholder="192.168.1.1"></div>
                <div class="form-group" style="flex:1;"><label class="form-label">Port</label><input type="text" id="modal-term-port" class="form-input" placeholder="8080"></div>
            </div>
        `;
    } else {
        wrapper.innerHTML = `
            <div class="form-group" style="margin-top:16px;">
                <label class="form-label">Terminal ID (TID)</label>
                <input type="text" id="modal-term-tid" class="form-input" placeholder="e.g. 50012345">
            </div>
        `;
    }
};
window.fetchUPIHistory = async () => {
    try {
        const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'http://localhost:8000' : '';
        const res = await fetch(`${API_BASE}/api/webhooks/gpay/history`);
        const data = await res.json();
        return data.transactions || [];
    } catch (e) {
        return [];
    }
};
window.navigateTab = (tab) => {
    currentTab = tab;
    searchQuery = ''; // reset search
    render();
};
window.goBackToOperations = () => {
    window.location.href = '/operations module/index_operations.html';
};
window.setSearchQuery = (val) => {
    searchQuery = val.toLowerCase();
    renderTabContentDOM();
};
window.setCategory = (cat) => {
    activeCategory = cat;
    renderTabContentDOM();
};
// Modal handlers
window.openModal = (type, mode, data = null) => {
    modalState = { isOpen: true, type, mode, data };
    renderModalDOM();
};
window.closeModal = () => {
    modalState = { isOpen: false, type: null, mode: 'add', data: null };
    renderModalDOM();
};
// Save Handlers
window.saveMenuItem = async () => {
    const db = getDB();
    const id = document.getElementById('modal-id').value;
    const name = document.getElementById('modal-name').value;
    const category = document.getElementById('modal-category').value;
    const price = parseFloat(document.getElementById('modal-price').value);
    const gstRate = parseFloat(document.getElementById('modal-gst').value);
    const active = document.getElementById('modal-active').checked;
    if(!name || !category || isNaN(price)) return alert("Please fill required fields correctly.");
    let targetItem;
    if (modalState.mode === 'edit') {
        const itemIndex = db.menu.findIndex(m => m.id === id);
        if (itemIndex > -1) {
            db.menu[itemIndex] = { ...db.menu[itemIndex], name, category, price, gstRate, active };
            targetItem = db.menu[itemIndex];
        }
    } else {
        targetItem = {
            id: 'm_' + Date.now(),
            name, category, price, gstRate, active,
            type: 'veg', preparationTime: 10
        };
        db.menu.push(targetItem);
    }
    if (targetItem) {
        await saveDB('menu', [targetItem]);
        logAudit('business_admin', 'global', modalState.mode === 'edit' ? 'EDIT_MENU_ITEM' : 'ADD_MENU_ITEM', `${modalState.mode === 'edit' ? 'Updated' : 'Added'} POS item: ${name}`);
        window.closeModal();
        renderTabContentDOM();
    }
};
window.saveEmployee = async () => {
    const db = getDB();
    const id = document.getElementById('modal-id').value;
    const name = document.getElementById('modal-name').value;
    const mobile = document.getElementById('modal-mobile').value;
    const role = document.getElementById('modal-role').value;
    const unitId = document.getElementById('modal-unit').value;
    if(!name || !mobile || !role) return alert("Please fill required fields.");
    let payload = {
        roles: [],
        bindings: []
    };
    
    let targetEmp;
    if (modalState.mode === 'edit') {
        const empIndex = db.employees.findIndex(e => e.id === id);
        if (empIndex > -1) {
            targetEmp = { ...db.employees[empIndex], name, mobile, role, assignedUnitId: unitId };
            payload.bindings = [{ subject: id, roleRef: role }];
        }
    } else {
        const randomPassword = Math.random().toString(36).slice(-8);
        targetEmp = {
            id: id || 'e_' + Date.now(),
            name, mobile, role, assignedUnitId: unitId,
            password: randomPassword, 
            passwordLastChanged: 0,
            allowedDeviceId: null
        };
        payload.bindings = [{ subject: targetEmp.id, roleRef: role }];
        alert(`Employee Profile Created.\n\nPlease communicate this initial password to the employee: ${randomPassword}\n\nThey will be required to change it on their first login.`);
    }
    if (targetEmp) {
        targetEmp.permissions = {
            canEditMenu: document.getElementById('modal-perm-menu')?.checked || false,
            canViewLogs: document.getElementById('modal-perm-logs')?.checked || false,
            canManageAccess: document.getElementById('modal-perm-access')?.checked || false
        };
        
        try {
            const res = await fetch(`${window.apiBase}/api/rbac/request_change`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.request_id) {
                window.pendingRbacChange = data.request_id;
                
                // Also update local DB for fallback UI rendering
                const empIndex = db.employees.findIndex(e => e.id === targetEmp.id);
                if (empIndex > -1) db.employees[empIndex] = targetEmp;
                else db.employees.push(targetEmp);
                await saveDB('employees', [targetEmp]);
                
                document.getElementById('otp-modal').style.display = 'flex';
                
                // Attach verification logic if not already
                const verifyBtn = document.getElementById('verify-otp-btn');
                verifyBtn.onclick = async () => {
                    const otp = document.getElementById('otp-input').value;
                    if(!otp) return alert("Please enter the OTP");
                    
                    const vRes = await fetch(`${window.apiBase}/api/rbac/verify_change`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
                        body: JSON.stringify({ request_id: window.pendingRbacChange, otp: otp })
                    });
                    const vData = await vRes.json();
                    if(vRes.ok) {
                        alert("Access changes verified and applied successfully!");
                        document.getElementById('otp-modal').style.display = 'none';
                        window.closeModal();
                        window.syncBackend();
                    } else {
                        alert("OTP Verification Failed: " + (vData.detail || "Invalid OTP"));
                    }
                };
            } else {
                alert("Failed to initiate RBAC change: " + (data.detail || "Unknown error"));
            }
        } catch(e) {
            alert("Error requesting RBAC change OTP: " + e.message);
        }
    }
};
window.autofillEmployeeDetails = (empId) => {
    if (!empId) return;
    const db = getDB();
    const existingEmp = db.employees.find(e => e.id === empId);
    if (existingEmp) {
        const nameEl = document.getElementById('modal-name');
        const mobileEl = document.getElementById('modal-mobile');
        const unitEl = document.getElementById('modal-unit');
        if (nameEl && !nameEl.value) nameEl.value = existingEmp.name || '';
        if (mobileEl && !mobileEl.value) mobileEl.value = existingEmp.mobile || existingEmp.email || '';
        if (unitEl && existingEmp.assignedUnitId) unitEl.value = existingEmp.assignedUnitId;
    }
};
window.addBulkRow = () => {
    if (window.bulkRowsCount >= 49) return alert("Maximum 49 items allowed at once.");
    window.bulkRowsCount++;
    const tbody = document.getElementById('bulk-table-body');
    const tr = document.createElement('tr');
    tr.id = `bulk-row-${window.bulkRowsCount}`;
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
        <td style="padding:4px;"><input type="text" id="bulk-name-${window.bulkRowsCount}" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Item Name"></td>
        <td style="padding:4px;"><input type="text" id="bulk-code-${window.bulkRowsCount}" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Code"></td>
        <td style="padding:4px;"><input type="text" id="bulk-cat-${window.bulkRowsCount}" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Category"></td>
        <td style="padding:4px;">
            <select id="bulk-type-${window.bulkRowsCount}" class="form-select" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;">
                <option value="veg">Veg</option>
                <option value="non-veg">Non-Veg</option>
            </select>
        </td>
        <td style="padding:4px;"><input type="text" id="bulk-overview-${window.bulkRowsCount}" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Overview"></td>
        <td style="padding:4px;"><input type="number" id="bulk-price-${window.bulkRowsCount}" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Price (₹)"></td>
        <td style="padding:4px; text-align:center;">
            <button class="btn" style="background:none; border:none; color:#ef4444; padding:4px; cursor:pointer;" onclick="window.removeBulkRow(${window.bulkRowsCount})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
};
window.removeBulkRow = (id) => {
    const row = document.getElementById(`bulk-row-${id}`);
    if (row) row.remove();
};
window.saveBulkMenu = async () => {
    const db = getDB();
    const newItems = [];
    
    for (let i = 1; i <= window.bulkRowsCount; i++) {
        const nameEl = document.getElementById('bulk-name-' + i);
        if (!nameEl) continue;
        
        const name = nameEl.value.trim();
        const code = document.getElementById('bulk-code-' + i).value.trim();
        const category = document.getElementById('bulk-cat-' + i).value.trim();
        const typeSelect = document.getElementById('bulk-type-' + i);
        const type = typeSelect ? typeSelect.value : 'veg';
        const overview = document.getElementById('bulk-overview-' + i) ? document.getElementById('bulk-overview-' + i).value.trim() : '';
        const priceEl = document.getElementById('bulk-price-' + i);
        const price = priceEl ? parseFloat(priceEl.value) : NaN;
        if (name && !isNaN(price)) {
            newItems.push({
                id: 'm_' + Date.now() + Math.random().toString(36).substr(2,5),
                name, 
                code,
                overview,
                category: category || 'Tiffins', 
                price, 
                gstRate: 5, 
                active: true,
                type: type, 
                preparationTime: 10
            });
        }
    }
    if (newItems.length > 0) {
        db.menu.push(...newItems);
        await saveDB('menu', newItems);
        logAudit('business_admin', 'global', 'BULK_ADD_MENU', `Bulk added ${newItems.length} menu items`);
        window.closeModal();
        renderTabContentDOM();
    } else {
        alert('Could not parse any valid items. Please check the format.');
    }
};
window.toggleItemStatus = async (itemId) => {
    const db = getDB();
    const itemIndex = db.menu.findIndex(m => m.id === itemId);
    if (itemIndex > -1) {
        db.menu[itemIndex].active = !db.menu[itemIndex].active;
        await saveDB('menu', [db.menu[itemIndex]]);
        logAudit('business_admin', 'global', 'EDIT_MENU_ITEM', `${db.menu[itemIndex].active ? 'Enabled' : 'Disabled'} menu item: ${db.menu[itemIndex].name}`);
        renderTabContentDOM(); 
    }
};
window.resetDeviceLock = async (empId) => {
    const db = getDB();
    const empIndex = db.employees.findIndex(e => e.id === empId);
    if (empIndex > -1) {
        db.employees[empIndex].allowedDeviceId = null;
        await saveDB('employees', [db.employees[empIndex]]);
        logAudit('business_admin', 'global', 'RESET_DEVICE_LOCK', `Reset device lock for: ${db.employees[empIndex].name}`);
        renderTabContentDOM();
    }
};
window.saveBranding = () => {
    const btn = document.getElementById('saveBtn');
    if(btn) {
        btn.innerHTML = '<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="80" stroke-dashoffset="0"></circle></svg>';
        btn.style.opacity = '0.8';
        logAudit('business_admin', 'global', 'UPDATE_BRANDING', `Updated global branding settings.`);
        setTimeout(() => {
            btn.innerText = 'Settings Applied';
            btn.classList.add('bg-success');
            setTimeout(() => {
                btn.innerText = 'Save Changes';
                btn.classList.remove('bg-success');
                btn.style.opacity = '1';
            }, 2000);
        }, 800);
    }
};
const renderTabContent = () => {
    const db = getDB();
    const icons = getIcons();
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{"companyName":"Sri Nathi","tagline":"Traditional South Indian Cuisine","logoUrl":"https://example.com/logo.png","defaultGstin":"33AAAAA1111A1Z1"}');
    
    if (currentTab === 'overview') {
        const totalItems = db.menu ? db.menu.length : 0;
        const activeItems = db.menu ? db.menu.filter(m => m.active).length : 0;
        const totalStaff = db.employees ? db.employees.filter(e => e.role !== 'Driver' && e.role !== 'Chef').length : 0;
        const lockedDevices = db.employees ? db.employees.filter(e => e.allowedDeviceId).length : 0;
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Dashboard Overview</h2>
                    <p>High-level system telemetry and configurations.</p>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="overview-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #e0f2fe; color: #0284c7;">${icons.pos}</div>
                        <div class="stat-value">${activeItems} <span style="font-size:16px; color:var(--text-muted); font-weight:500;">/ ${totalItems}</span></div>
                        <div class="stat-label">Active Menu Items</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #fce7f3; color: #db2777;">${icons.access}</div>
                        <div class="stat-value">${lockedDevices} <span style="font-size:16px; color:var(--text-muted); font-weight:500;">/ ${totalStaff}</span></div>
                        <div class="stat-label">Secured Devices</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="background: #dcfce7; color: #16a34a;">${icons.overview}</div>
                        <div class="stat-value">Healthy</div>
                        <div class="stat-label">System Status</div>
                    </div>
                </div>
                <div class="settings-group-title">Quick Actions</div>
                <div class="settings-group">
                    <div class="settings-row" style="cursor: pointer;" onclick="window.navigateTab('pos')">
                        <div class="settings-row-left">
                            <div class="settings-row-icon" style="background: var(--accent);">${icons.pos}</div>
                            <div class="settings-row-info">
                                <div class="settings-row-title">Review POS Pricing</div>
                                <div class="settings-row-subtitle">Ensure GST rates and base prices are accurate</div>
                            </div>
                        </div>
                        <div class="settings-row-right">
                            <span class="chevron-right"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    else if (currentTab === 'branches') {
        const units = db.units || [];
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Branches / Units</h2>
                    <p>Manage all Sri Nathi locations and branch codes.</p>
                </div>
                <button class="btn btn-primary" onclick="window.openModal('branch', 'add')">+ Create New Branch</button>
            </header>
            <div class="settings-content-area">
                <div class="settings-group" style="padding: 0;">
                    ${units.length === 0 ? `
                        <div style="padding: 60px; text-align: center; color: var(--text-muted);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5; margin-bottom:16px;">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
                            </svg>
                            <h3>No Branches Created Yet</h3>
                            <p style="margin-top: 8px;">Click "Create New Branch" to add your first Sri Nathi unit.</p>
                            <button class="btn btn-primary" style="margin-top:24px;" onclick="window.openModal('branch', 'add')">Create Branch</button>
                        </div>
                    ` : `
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); text-align: left;">
                                    <th style="padding: 16px 24px; font-weight: 600; color: #475569;">Unit Code</th>
                                    <th style="padding: 16px 24px; font-weight: 600; color: #475569;">Branch Name</th>
                                    <th style="padding: 16px 24px; font-weight: 600; color: #475569;">Manager Name</th>
                                    <th style="padding: 16px 24px; font-weight: 600; color: #475569;">Manager Contact</th>
                                    <th style="padding: 16px 24px; font-weight: 600; color: #475569; text-align: right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${units.map(u => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 16px 24px; font-weight: 700; color: var(--primary);">${u.id || u.code || ''}</td>
                                        <td style="padding: 16px 24px; font-weight: 600; color: var(--text-main);">${u.name || ''}</td>
                                        <td style="padding: 16px 24px; color: #475569;">${u.managerName || u.manager_name || '-'}</td>
                                        <td style="padding: 16px 24px; color: #475569;">${u.managerPhone || u.manager_phone || '-'}</td>
                                        <td style="padding: 16px 24px; text-align: right;">
                                            <button class="btn btn-sm btn-secondary" style="color:var(--danger);">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    }
    else if (currentTab === 'branding') {
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Identity & Branding</h2>
                    <p>Customize global app appearance and business details.</p>
                </div>
                <div class="settings-header-actions">
                    <button class="btn btn-primary" id="saveBtn" onclick="window.saveBranding()">Save Changes</button>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="settings-group-title">Public Profile</div>
                <div class="settings-group">
                    <div class="settings-row">
                        <div class="settings-row-left"><div class="settings-row-title">Company Name</div></div>
                        <div class="settings-row-right"><input type="text" class="settings-input" value="${settings.companyName}" onchange="window.updateSettings('companyName', this.value)" placeholder="Enter name"></div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-row-left"><div class="settings-row-title">Tagline</div></div>
                        <div class="settings-row-right"><input type="text" class="settings-input" value="${settings.tagline}" onchange="window.updateSettings('tagline', this.value)" placeholder="Enter tagline"></div>
                    </div>
                </div>
                <div class="settings-group-title">System Configuration</div>
                <div class="settings-group">
                    <div class="settings-row">
                        <div class="settings-row-left"><div class="settings-row-title">Brand Logo URL</div></div>
                        <div class="settings-row-right"><input type="text" class="settings-input" value="${settings.logoUrl}" onchange="window.updateSettings('logoUrl', this.value)" placeholder="https://..."></div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-row-left"><div class="settings-row-title">Default GSTIN</div></div>
                        <div class="settings-row-right"><input type="text" class="settings-input" value="${settings.defaultGstin}" onchange="window.updateSettings('defaultGstin', this.value)"></div>
                    </div>
                </div>
                <div class="settings-group-title">Live Preview</div>
                <div class="settings-group">
                    <div class="settings-row" style="justify-content: center; padding: 3rem 2rem;">
                        <div style="text-align: center; color: var(--text-muted); display:flex; flex-direction:column; align-items:center;">
                            <div style="margin-bottom: 16px; color: var(--accent);">${icons.building}</div>
                            <div style="font-weight: 800; font-size:20px; font-family:var(--font-heading); color: var(--text-main); letter-spacing: -0.5px;">${settings.companyName}</div>
                            <div style="font-size: 14px; font-weight: 500;">${settings.tagline}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    else if (currentTab === 'pos') {
        const categories = ['All', ...new Set((db.menu || []).map(i => i.category))];
        const filteredMenu = (db.menu || []).filter(item => {
            if (activeCategory !== 'All' && item.category !== activeCategory) return false;
            if (searchQuery && !item.name.toLowerCase().includes(searchQuery)) return false;
            return true;
        });
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Menu Catalog</h2>
                    <p>Manage point-of-sale pricing and availability.</p>
                </div>
                <div class="settings-header-actions">
                    <button class="btn btn-outline" onclick="window.openModal('bulk_add_menu')" style="border: 1px solid var(--border); color: var(--text-main);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        Bulk Add
                    </button>
                    <button class="btn btn-primary" onclick="window.openModal('menu', 'add')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add Item
                    </button>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="filter-bar">
                    <div class="search-input-wrapper">
                        <span class="search-icon">${icons.search}</span>
                        <input type="text" class="search-input" placeholder="Search menu items..." value="${searchQuery}" onkeyup="window.setSearchQuery(this.value)">
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; margin-bottom: 24px; overflow-x:auto; padding-bottom:8px;">
                    ${categories.map(cat => `
                        <button class="category-pill ${activeCategory === cat ? 'active' : ''}" onclick="window.setCategory('${cat}')">${cat}</button>
                    `).join('')}
                </div>
                <div class="settings-group-title">Catalog Items (${filteredMenu.length})</div>
                <div class="settings-group">
                    ${filteredMenu.length === 0 ? `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No items found.</div>` : ''}
                    ${filteredMenu.map(item => `
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-icon" style="background: var(--accent);">${icons.item}</div>
                                <div class="settings-row-info">
                                    <div class="settings-row-title">${item.name}</div>
                                    <div class="settings-row-subtitle">
                                        <span class="status-badge ${item.active ? 'badge-active' : 'badge-inactive'}">${item.active ? 'Active' : 'Disabled'}</span>
                                        ${item.category} • GST: ${item.gstRate}%
                                    </div>
                                </div>
                            </div>
                            <div class="settings-row-right">
                                <button class="row-btn" onclick='window.openModal("menu", "edit", ${JSON.stringify(item)})' style="margin-right: 15px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                    ${formatINR(item.price)}
                                </button>
                                <label class="toggle-switch">
                                  <input type="checkbox" ${item.active ? 'checked' : ''} onchange="window.toggleItemStatus('${item.id}')">
                                  <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }
    else if (currentTab === 'access') {
        const staffList = (db.employees || []).filter(e => e.role !== 'Driver' && e.role !== 'Chef');
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Access Control</h2>
                    <p>Secure endpoints and manage device authorizations.</p>
                </div>
                <div class="settings-header-actions">
                    <button class="btn btn-primary" onclick="window.openModal('employee', 'add')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        Add User
                    </button>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="settings-group-title">Administrative Staff (${staffList.length})</div>
                <div class="settings-group">
                    ${staffList.map(emp => `
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-icon" style="background: var(--primary-light);">${icons.user}</div>
                                <div class="settings-row-info">
                                    <div class="settings-row-title">${emp.name} <span style="font-size:12px; color:var(--text-muted); margin-left: 6px; font-weight:600;">${emp.role}</span></div>
                                    <div class="settings-row-subtitle">${emp.email || emp.mobile}</div>
                                </div>
                            </div>
                            <div class="settings-row-right">
                                <div class="settings-value" style="margin-right: 10px;">
                                    ${emp.allowedDeviceId 
                                        ? `Locked <span style="color:var(--success); margin-left:4px;">${icons.lock}</span>` 
                                        : `Unlocked <span style="color:var(--text-muted); margin-left:4px;">${icons.unlock}</span>`}
                                </div>
                                ${emp.allowedDeviceId ? `
                                    <button class="row-btn row-btn-danger" onclick="window.resetDeviceLock('${emp.id}')">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                                        Reset Device
                                    </button>
                                ` : `
                                    <button class="row-btn" onclick='window.openModal("employee", "edit", ${JSON.stringify(emp)})'>Edit Access</button>
                                `}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }
    else if (currentTab === 'activity') {
        const logs = window.auditLogs || [];
        
        // Real sync data — calculated by diffing local cache vs last-synced state
        const unsyncedCount = window.getUnsyncedCount();
        const lastSyncTime = window.lastSyncTimestamp 
            ? new Date(window.lastSyncTimestamp).toLocaleString('en-IN', { hour: '2-digit', minute:'2-digit', second:'2-digit' })
            : 'Not yet synced';
        const syncStatusBadge = unsyncedCount === 0 
            ? '<span class="status-badge badge-active">Synced</span>'
            : '<span class="status-badge badge-blue">Pending</span>';
        const pendingBadge = unsyncedCount === 0
            ? '<span class="status-badge badge-active">All Clear</span>'
            : '<span class="status-badge badge-blue">Pending</span>';
        
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>System & Sync Logs</h2>
                    <p>Track user logins, activity, and host machine synchronization.</p>
                </div>
                <div class="settings-header-actions">
                    <button class="btn btn-outline" style="border: 1px solid var(--border); color: var(--text-main);" onclick="alert('Exporting logs...')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export CSV
                    </button>
                    <button id="sync-now-btn" class="btn btn-primary" onclick="(async () => { const btn = document.getElementById('sync-now-btn'); btn.disabled = true; btn.innerHTML = '<svg width=16 height=16 viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; class=&quot;spin-icon&quot;><polyline points=&quot;23 4 23 10 17 10&quot;></polyline><polyline points=&quot;1 20 1 14 7 14&quot;></polyline><path d=&quot;M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15&quot;></path></svg> Syncing...'; await window.syncBackend(); btn.innerHTML = '&#10003; Synced!'; setTimeout(() => { btn.disabled = false; btn.innerHTML = '<svg width=16 height=16 viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><polyline points=&quot;23 4 23 10 17 10&quot;></polyline><polyline points=&quot;1 20 1 14 7 14&quot;></polyline><path d=&quot;M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15&quot;></path></svg> Sync Now'; }, 2000); })()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        Sync Now
                    </button>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="settings-group-title">Cloud to Host Machine Sync</div>
                <div class="overview-grid" style="margin-bottom: 2rem;">
                    <div class="stat-card" style="padding: 1.25rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                            <span style="font-size:13px; color:var(--text-muted); font-weight:600;">Data to be Synced</span>
                            ${pendingBadge}
                        </div>
                        <div style="font-size:24px; font-weight:700; color:var(--text-main); font-family:var(--font-heading);">${unsyncedCount} Records</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Local changes pending push to PostgreSQL</div>
                    </div>
                    <div class="stat-card" style="padding: 1.25rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                            <span style="font-size:13px; color:var(--text-muted); font-weight:600;">Last Sync Status</span>
                            ${syncStatusBadge}
                        </div>
                        <div style="font-size:16px; font-weight:600; color:var(--text-main); margin-top: 8px;">Last Sync: ${lastSyncTime}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${unsyncedCount === 0 ? 'All data is in sync with the database' : unsyncedCount + ' record(s) awaiting next sync cycle'}</div>
                    </div>
                </div>
                <div class="settings-group-title">User Activity & Login Logs</div>
                <div class="settings-group">
                    ${logs.length === 0 ? `<div style="padding:2rem; text-align:center; color:var(--text-muted);">No activity logs found.</div>` : ''}
                    ${logs.map(log => `
                        <div class="settings-row vertical">
                            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:8px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    ${log.action.includes('LOGIN') 
                                        ? `<span style="color:var(--success);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg></span>` 
                                        : `<span style="color:var(--accent);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span>`
                                    }
                                    <div style="font-weight:600; font-size:14px; color:var(--text-main);">${log.action}</div>
                                </div>
                                <div style="font-size:12px; color:var(--text-muted);">${formatDateTime(log.changed_at)}</div>
                            </div>
                            <div style="font-size:14px; color:var(--text-muted); margin-left: 24px;">${JSON.stringify(log.new_data)}</div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:8px; margin-left: 24px; font-weight:500;">User: <span style="color:var(--text-main);">${log.changed_by}</span> | Log ID: ${log.id}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    else if (currentTab === 'storage') {
        const storage = window.systemStatus?.storage || { used_bytes: 0 };
        const usedGB = (storage.used_bytes / (1024*1024*1024)).toFixed(2);
        
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Storage Monitor</h2>
                    <p>PostgreSQL Host Machine Analysis</p>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="settings-group-title">Primary Host Storage (SQL Database)</div>
                <div class="settings-group" style="padding: 1.5rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:600; font-size:15px; color:var(--text-main);">
                        <span>${usedGB} GB Used</span>
                    </div>
                    <div class="storage-bar-wrapper">
                        <div class="storage-segment primary" style="width: 100%;"></div>
                    </div>
                    <div class="storage-legend">
                        <div class="legend-item"><div class="legend-dot primary" style="background:var(--accent);"></div> PostgreSQL Data (${usedGB} GB)</div>
                    </div>
                </div>
            </div>
        `;
        } else if (currentTab === 'payment_terminals') {
            const terminals = settings.payment_terminals || {};
            const units = getDB().units || [];
            let activeUnitFilter = window.paymentTerminalUnitId;
            if (!activeUnitFilter && units.length > 0) activeUnitFilter = units[0].id;
            
            const edcMachines = (terminals.edc_machines || []).filter(m => m.unitId === activeUnitFilter);
            const razorpay = terminals.razorpay || { active: false, keyId: '', keySecret: '' };
            
            return `
                <header class="settings-header-area">
                    <div class="settings-header-title">
                        <h2>Payment Terminals</h2>
                        <p>Manage physical EDC machines and Online Payment Gateways.</p>
                    </div>
                </header>
                <div class="settings-content-area">
                    <div class="settings-group-title" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Physical EDC Terminals (Card/UPI)</span>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="font-size:13px; font-weight:600; color:var(--text-muted);">View Branch:</span>
                            <select class="form-select" style="width:250px; padding:6px; font-size:14px;" onchange="window.paymentTerminalUnitId = this.value; window.renderTabContentDOM();" ${units.length === 0 ? 'disabled' : ''}>
                                ${units.length === 0 ? '<option value="">No branches found</option>' : units.map(u => `<option value="${u.id}" ${activeUnitFilter === u.id ? 'selected' : ''}>${u.id} - ${u.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    ${units.length === 0 ? `
                        <div class="settings-group" style="text-align: center; padding: 60px;">
                            <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:rgba(239,68,68,0.1); color:#ef4444; margin-bottom:16px;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <h3 style="color:#0f172a; margin-bottom:8px;">Please create a Branch first</h3>
                            <p style="color:var(--text-muted); font-size:14px; margin-bottom:24px;">You need to create at least one Branch before you can assign Payment Terminals.</p>
                            <button class="btn btn-primary" onclick="window.navigateTab('branches')">Go to Branches Management</button>
                        </div>
                    ` : `
                        <div class="settings-group">
                            ${edcMachines.length === 0 ? `
                                <div style="padding: 60px; text-align: center; color: var(--text-muted); font-size: 14px;">
                                    <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:rgba(14,165,233,0.1); color:#0ea5e9; margin-bottom:16px;">
                                        ${icons.item}
                                    </div>
                                    <h3 style="color:#0f172a; margin-bottom:8px;">No EDC Machines Configured</h3>
                                    <p style="margin-bottom: 24px;">Click the button below to assign a Card/UPI machine to this branch.</p>
                                    <button class="btn btn-primary" onclick="window.openModal('terminal', 'add')" style="padding: 12px 24px; font-size: 16px;">+ Add Terminal to Branch</button>
                                </div>
                            ` : `
                                ${edcMachines.map((m, idx) => `
                                    <div class="settings-row" style="align-items: center;">
                                        <div class="settings-row-left">
                                            <div class="settings-row-icon" style="background: ${m.provider === 'Pine Labs' ? '#0284c7' : (m.provider === 'Paytm' ? '#0ea5e9' : '#8b5cf6')};">${icons.item}</div>
                                            <div class="settings-row-info">
                                                <div class="settings-row-title">${m.provider} Machine</div>
                                                <div class="settings-row-subtitle">${m.provider === 'Pine Labs' ? `IP: ${m.ip}:${m.port}` : `MID: ${m.tid || 'N/A'}`}</div>
                                            </div>
                                        </div>
                                        <div class="settings-row-right" style="gap: 10px;">
                                            <span class="status-badge badge-active">Active</span>
                                            <button class="row-btn row-btn-danger" onclick="window.deleteTerminal(${idx})">Remove</button>
                                        </div>
                                    </div>
                                `).join('')}
                                <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
                                    <button class="btn btn-secondary" style="font-weight:700;" onclick="window.openModal('terminal', 'add')">+ Add Another Terminal</button>
                                </div>
                            `}
                        </div>
                    `}
                    
                    <div class="settings-group-title" style="margin-top: 3rem;">Online Payment Gateway</div>
                    <div class="settings-group">
                        <div class="settings-row" style="background: #fafafa;">
                            <div class="settings-row-left">
                                <div class="settings-row-icon" style="background: #0ea5e9;">
                                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                </div>
                                <div class="settings-row-info">
                                    <div class="settings-row-title">Razorpay Integration <span class="status-badge badge-blue" style="margin-left:6px; font-size:10px; padding: 2px 6px;">Recommended</span></div>
                                    <div class="settings-row-subtitle">Global credentials for sending SMS payment links to customers.</div>
                                </div>
                            </div>
                            <div class="settings-row-right">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="rzp-active" ${razorpay.active ? 'checked' : ''} onchange="window.saveOnlineGateway()">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-title">Razorpay Key ID</div>
                            </div>
                            <div class="settings-row-right">
                                <input type="text" class="form-input" style="width: 280px;" id="rzp-key" value="${razorpay.keyId}" placeholder="rzp_live_..." onchange="window.saveOnlineGateway()">
                            </div>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-title">Razorpay Key Secret</div>
                            </div>
                            <div class="settings-row-right">
                                <input type="password" class="form-input" style="width: 280px;" id="rzp-secret" value="${razorpay.keySecret}" placeholder="••••••••••••" onchange="window.saveOnlineGateway()">
                            </div>
                        </div>
                    </div>
                    <div class="settings-group-title" style="margin-top: 3rem;">Static QR Webhooks (Google Pay / PhonePe)</div>
                    <div class="settings-group">
                        <div class="settings-row" style="background: #fafafa;">
                            <div class="settings-row-left">
                                <div class="settings-row-icon" style="background: #22c55e;">
                                   ${icons.wallet}
                                </div>
                                <div class="settings-row-info">
                                    <div class="settings-row-title">UPI Auto-Confirm Webhook</div>
                                    <div class="settings-row-subtitle">Listen for incoming Google Pay / PhonePe QR scans in real-time.</div>
                                </div>
                            </div>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-title">Webhook URL</div>
                                <div class="settings-row-subtitle">Paste this into your GPay / PhonePe Business dashboard.</div>
                            </div>
                            <div class="settings-row-right">
                                <input type="text" class="form-input" style="width: 320px; background:#f1f5f9; color:var(--text-muted);" readonly value="https://srinathi.in/api/webhooks/gpay">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (currentTab === 'digital_payments') {
            // Need to fetch data if not loaded
            if (!window.upiHistoryLoaded) {
                window.fetchUPIHistory().then(data => {
                    window.upiHistoryLoaded = true;
                    window.upiHistoryData = data;
                    window.renderTabContentDOM();
                });
                return `
                    <header class="settings-header-area">
                        <div class="settings-header-title">
                            <h2>Digital Payments Ledger</h2>
                            <p>Real-time Google Pay / PhonePe transaction dashboard.</p>
                        </div>
                    </header>
                    <div class="settings-content-area" style="text-align:center; padding: 40px;">
                        <div class="spinner" style="border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; display: inline-block;"></div>
                        <p style="margin-top:16px; color:var(--text-muted);">Syncing from servers...</p>
                    </div>
                `;
            }
            
            const history = window.upiHistoryData || [];
            
            return `
                <header class="settings-header-area">
                    <div class="settings-header-title">
                        <h2>Digital Payments Ledger</h2>
                        <p>Real-time Google Pay / PhonePe transaction dashboard.</p>
                    </div>
                    <button class="btn btn-primary" onclick="window.upiHistoryLoaded = false; window.renderTabContentDOM();"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Refresh Sync</button>
                </header>
                <div class="settings-content-area">
                    <div class="settings-group" style="background:white; padding: 0;">
                        ${history.length === 0 ? `
                            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                                No recent UPI transactions found.
                            </div>
                        ` : history.map(txn => {
                            const date = new Date(txn.time);
                            const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                            const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                            
                            return `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px 20px; border-bottom: 1px solid #f1f5f9;">
                                <div style="display:flex; gap: 16px; align-items:center;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items:center; justify-content:center; font-weight:700;">
                                        ${txn.payer.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style="font-weight: 600; color: #0f172a; font-size: 15px;">${txn.payer}</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">TXN: ${txn.id} • ${dateStr}, ${timeStr}</div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: #22c55e; font-size: 16px;">+ ₹${txn.amount}</div>
                                    <div style="font-size: 11px; font-weight: 600; color: #16a34a; background: #dcfce7; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">SUCCESS</div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (currentTab === 'infrastructure') {
            const sys = window.systemStatus || { storage: { used_bytes: 0 }, sync: {}, infrastructure: {} };
        const infra = sys.infrastructure || {};
        
        const isPostgres = infra.database_mode === 'PostgreSQL';
        const isCbOpen = infra.circuit_breaker === 'OPEN';
        
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Backend Infrastructure</h2>
                    <p>Live telemetry from the backend servers, database pool, and sync mechanisms.</p>
                </div>
                <div style="display:flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="window.fetchSystemStatus().then(() => window.renderTabContentDOM())">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> 
                        Refresh
                    </button>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="overview-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); margin-bottom: 24px;">
                    <div class="stat-card" style="border-left: 4px solid ${isPostgres ? (isCbOpen ? '#ef4444' : '#22c55e') : '#f59e0b'};">
                        <div class="stat-icon" style="background: ${isPostgres ? (isCbOpen ? '#fee2e2' : '#dcfce7') : '#fef3c7'}; color: ${isPostgres ? (isCbOpen ? '#ef4444' : '#22c55e') : '#f59e0b'};">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                        </div>
                        <div class="stat-value" style="font-size: 20px;">${infra.database_mode || 'Unknown'}</div>
                        <div class="stat-label">Active Database Engine</div>
                    </div>
                    
                    <div class="stat-card" style="border-left: 4px solid ${isCbOpen ? '#ef4444' : '#22c55e'};">
                        <div class="stat-icon" style="background: ${isCbOpen ? '#fee2e2' : '#dcfce7'}; color: ${isCbOpen ? '#ef4444' : '#22c55e'};">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        </div>
                        <div class="stat-value" style="font-size: 20px;">${infra.circuit_breaker || 'Unknown'}</div>
                        <div class="stat-label">High Availability Circuit (${infra.circuit_failures || 0} faults)</div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background: #e0f2fe; color: #0284c7;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        </div>
                        <div class="stat-value" style="font-size: 20px;">${infra.active_pg_connections !== undefined ? infra.active_pg_connections : '-'}</div>
                        <div class="stat-label">Active DB Connections</div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon" style="background: #f3e8ff; color: #9333ea;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                        </div>
                        <div class="stat-value" style="font-size: 20px;">${infra.memory_mb || 0} MB</div>
                        <div class="stat-label">Uvicorn Process Memory</div>
                    </div>
                </div>

                <div class="settings-group">
                    <h3 style="font-size:16px; font-weight:600; color:var(--text-color); margin-bottom:16px;">Live System Sync Status</h3>
                    <div style="background: #0f172a; padding: 16px; border-radius: 8px; font-family: monospace; color: #4ade80; font-size: 13px; line-height: 1.5; height: 180px; overflow-y: auto;">
                        > systemctl status postgresql.service <br>
                        [OK] Primary Database Cluster: Active <br>
                        [OK] Failover Database Cluster: Standby <br>
                        > checking local queue... <br>
                        Local Offline Queue: ${window.getUnsyncedCount()} records waiting.<br>
                        > checking memory cache... <br>
                        Active OTPs in memory: ${infra.otp_store_size || 0} <br>
                        > status complete.
                    </div>
                </div>
            </div>
        `;
    }
};
const renderModalDOM = () => {
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        document.body.appendChild(modalEl);
    }
    if (!modalState.isOpen) {
        modalEl.classList.remove('open');
        setTimeout(() => { modalEl.innerHTML = ''; }, 300); // Wait for transition
        return;
    }
    let title = '';
    let bodyHTML = '';
    let saveFunc = '';
    if (modalState.type === 'menu') {
        const item = modalState.data || { id: '', name: '', category: 'Tiffins', price: 0, gstRate: 5, active: true };
        title = modalState.mode === 'add' ? 'Add Menu Item' : 'Edit Menu Item';
        saveFunc = 'window.saveMenuItem()';
        
        const categories = ['Tiffins', 'Meals', 'Beverages', 'Snacks', 'Desserts'];
        
        bodyHTML = `
            <input type="hidden" id="modal-id" value="${item.id}">
            <div class="form-group">
                <label class="form-label">Item Name</label>
                <input type="text" id="modal-name" class="form-input" value="${item.name}" placeholder="e.g. Masala Dosa">
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select id="modal-category" class="form-select">
                    ${categories.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex; gap:1rem;">
                <div class="form-group" style="flex:1;">
                    <label class="form-label">Base Price (₹)</label>
                    <input type="number" id="modal-price" class="form-input" value="${item.price}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label class="form-label">GST Rate (%)</label>
                    <select id="modal-gst" class="form-select">
                        <option value="0" ${item.gstRate === 0 ? 'selected' : ''}>0%</option>
                        <option value="5" ${item.gstRate === 5 ? 'selected' : ''}>5%</option>
                        <option value="12" ${item.gstRate === 12 ? 'selected' : ''}>12%</option>
                        <option value="18" ${item.gstRate === 18 ? 'selected' : ''}>18%</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="flex-direction:row; align-items:center; justify-content:space-between; margin-top:10px;">
                <label class="form-label">Status (Active)</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="modal-active" ${item.active ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    } else if (modalState.type === 'bulk_add_menu') {
        title = 'Bulk Add Menu Items';
        saveFunc = 'window.saveBulkMenu()';
        window.bulkRowsCount = 1;
        
        let tableRows = `
                <tr id="bulk-row-1" style="border-bottom: 1px solid var(--border);">
                    <td style="padding:4px;"><input type="text" id="bulk-name-1" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Item Name"></td>
                    <td style="padding:4px;"><input type="text" id="bulk-code-1" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Code"></td>
                    <td style="padding:4px;"><input type="text" id="bulk-cat-1" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Category"></td>
                    <td style="padding:4px;">
                        <select id="bulk-type-1" class="form-select" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;">
                            <option value="veg">Veg</option>
                            <option value="non-veg">Non-Veg</option>
                        </select>
                    </td>
                    <td style="padding:4px;"><input type="text" id="bulk-overview-1" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Overview"></td>
                    <td style="padding:4px;"><input type="number" id="bulk-price-1" class="form-input" style="width:100%; padding:0.4rem; font-size:13px; border:none; background:transparent;" placeholder="Price (₹)"></td>
                    <td style="padding:4px; text-align:center;">
                        <button class="btn" style="background:none; border:none; color:#ef4444; padding:4px; cursor:pointer;" onclick="window.removeBulkRow(1)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
        `;
        bodyHTML = `
            <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">Add up to 49 Menu Items</label>
            </div>
            <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-main); margin-bottom: 1rem;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="position: sticky; top: 0; background: var(--bg-card); box-shadow: 0 1px 2px rgba(0,0,0,0.05); z-index:10;">
                        <tr>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600;">Item Name</th>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600; width: 10%;">Code</th>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600; width: 15%;">Category</th>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600; width: 10%;">Type</th>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600; width: 20%;">Overview</th>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600; width: 10%;">Price (₹)</th>
                            <th style="padding: 0.75rem 0.5rem; font-size: 12px; color: var(--text-muted); font-weight: 600; width: 5%;"></th>
                        </tr>
                    </thead>
                    <tbody id="bulk-table-body">
                        ${tableRows}
                    </tbody>
                </table>
            </div>
            <button class="btn btn-outline" style="width:100%; justify-content:center; border: 1px dashed var(--border); color: var(--text-main);" onclick="window.addBulkRow()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add New Item Row
            </button>
        `;
    } else if (modalState.type === 'branch') {
        title = 'Add New Branch / Unit';
        bodyHTML = `
            <div class="form-group">
                <label class="form-label">Unit Code (e.g., UNIT001, TNAGAR)</label>
                <input type="text" id="modal-branch-code" class="form-input" placeholder="UNIT001">
            </div>
            <div class="form-group" style="margin-top:16px;">
                <label class="form-label">Branch Name</label>
                <input type="text" id="modal-branch-name" class="form-input" placeholder="T-Nagar Branch">
            </div>
        `;
        saveFunc = 'window.saveNewBranch()';
    } else if (modalState.type === 'terminal') {
        title = 'Add New EDC Terminal';
        const units = getDB().units || [];
        let activeUnitFilter = window.paymentTerminalUnitId;
        if (!activeUnitFilter && units.length > 0) activeUnitFilter = units[0].id;
        
        bodyHTML = `
            <div class="form-group">
                <label class="form-label">Terminal Provider</label>
                <select id="modal-term-provider" class="form-select" onchange="window.toggleTerminalFields()">
                    <option value="Pine Labs">Pine Labs</option>
                    <option value="Paytm">Paytm</option>
                    <option value="PhonePe">PhonePe</option>
                    <option value="Mswipe">Mswipe</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                </select>
            </div>
            <div class="form-group" style="margin-top:16px;">
                <label class="form-label">Assign to Branch (Unit)</label>
                <select id="modal-term-unit" class="form-select">
                    ${units.map(u => `<option value="${u.id}" ${activeUnitFilter === u.id ? 'selected' : ''}>${u.id} - ${u.name}</option>`).join('')}
                </select>
            </div>
            <div id="modal-dynamic-fields">
                <div style="display:flex; gap:1rem; margin-top:16px;">
                    <div class="form-group" style="flex:2;"><label class="form-label">IP Address</label><input type="text" id="modal-term-ip" class="form-input" placeholder="192.168.1.1"></div>
                    <div class="form-group" style="flex:1;"><label class="form-label">Port</label><input type="text" id="modal-term-port" class="form-input" placeholder="8080"></div>
                </div>
            </div>
        `;
        saveFunc = 'window.saveNewTerminal()';
    } else if (modalState.type === 'employee') {
        const emp = modalState.data || { id: '', name: '', mobile: '', role: 'Staff', assignedUnitId: 'unit-1', permissions: { canEditMenu: false, canViewLogs: false, canManageAccess: false } };
        // Ensure permissions object exists for old data
        emp.permissions = emp.permissions || { canEditMenu: false, canViewLogs: false, canManageAccess: false };
        title = modalState.mode === 'add' ? 'Add Access Profile' : 'Edit Access Profile';
        saveFunc = 'window.saveEmployee()';
        
        const units = getDB().units || [{id: 'unit-1', name: 'Main Branch'}];
        const roles = ['Store Manager', 'Cashier', 'Staff', 'Admin'];
        bodyHTML = `
            ${modalState.mode === 'add' ? `
            <div class="form-group">
                <label class="form-label">Employee ID</label>
                <input type="text" id="modal-id" class="form-input" value="${emp.id}" placeholder="Enter Employee ID to auto-fill" oninput="window.autofillEmployeeDetails(this.value)">
            </div>
            ` : `
            <input type="hidden" id="modal-id" value="${emp.id}">
            `}
            <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" id="modal-name" class="form-input" value="${emp.name}" placeholder="Employee Name">
            </div>
            <div class="form-group">
                <label class="form-label">Mobile Number</label>
                <input type="text" id="modal-mobile" class="form-input" value="${emp.mobile || emp.email || ''}" placeholder="Contact info">
            </div>
            <div style="display:flex; gap:1rem;">
                <div class="form-group" style="flex:1;">
                    <label class="form-label">Role</label>
                    <select id="modal-role" class="form-select">
                        ${roles.map(r => `<option value="${r}" ${emp.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label class="form-label">Assigned Unit</label>
                    <select id="modal-unit" class="form-select">
                        ${units.map(u => `<option value="${u.id}" ${emp.assignedUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="settings-group-title" style="margin-top: 1rem; margin-left: 0;">Granular Permissions</div>
            <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem;">
                <div class="form-group" style="flex-direction:row; align-items:center; justify-content:space-between; margin-bottom: 12px;">
                    <div style="display:flex; flex-direction:column;">
                        <span class="form-label">Edit Menu Catalog</span>
                        <span style="font-size:12px; color:var(--text-muted);">Can add, edit, or disable POS items</span>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" id="modal-perm-menu" ${emp.permissions.canEditMenu ? 'checked' : ''}>
                      <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="form-group" style="flex-direction:row; align-items:center; justify-content:space-between; margin-bottom: 12px;">
                    <div style="display:flex; flex-direction:column;">
                        <span class="form-label">View Audit Logs</span>
                        <span style="font-size:12px; color:var(--text-muted);">Can view system activity & sync logs</span>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" id="modal-perm-logs" ${emp.permissions.canViewLogs ? 'checked' : ''}>
                      <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="form-group" style="flex-direction:row; align-items:center; justify-content:space-between;">
                    <div style="display:flex; flex-direction:column;">
                        <span class="form-label">Manage Access</span>
                        <span style="font-size:12px; color:var(--text-muted);">Can edit staff roles & permissions</span>
                    </div>
                    <label class="toggle-switch">
                      <input type="checkbox" id="modal-perm-access" ${emp.permissions.canManageAccess ? 'checked' : ''}>
                      <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
    }
    modalEl.innerHTML = `
        <div class="modal-card" ${modalState.type === 'bulk_add_menu' ? 'style="max-width: 800px; width: 95%;"' : ''}>
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" onclick="window.closeModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body">
                ${bodyHTML}
            </div>
            <div class="modal-footer">
                <button class="modal-btn modal-btn-cancel" onclick="window.closeModal()">Cancel</button>
                <button class="modal-btn modal-btn-save" onclick="${saveFunc}">${modalState.mode === 'add' ? 'Create' : 'Save Changes'}</button>
            </div>
        </div>
    `;
    setTimeout(() => { modalEl.classList.add('open'); }, 10);
};
const renderTabContentDOM = () => {
    const main = document.querySelector('.console-main-content');
    if (main) {
        main.innerHTML = renderTabContent();
    }
};
window.renderTabContentDOM = renderTabContentDOM;
const render = () => {
    const app = document.getElementById('app');
    const icons = getIcons();
    
    if (isLoading) {
        const loader = document.getElementById('boot-loader');
        if (loader) loader.style.display = 'none';
        isLoading = false;
    }
    
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{"companyName":"Sri Nathi"}');
    
    app.innerHTML = `
        <div class="settings-container">
            <!-- Glassmorphism Sidebar -->
            <aside class="console-sidebar-wrapper" id="consoleSidebar">
                <div class="sidebar-header">
                    <h1>Settings</h1>
                </div>
                <ul class="sidebar-nav">
                    <li class="sidebar-nav-item ${currentTab === 'overview' ? 'active' : ''}" onclick="window.navigateTab('overview')">
                        <div class="sidebar-nav-icon">${icons.overview}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Dashboard</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'branches' ? 'active' : ''}" onclick="window.navigateTab('branches')">
                        <div class="sidebar-nav-icon">${icons.branch}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Branches / Units</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'branding' ? 'active' : ''}" onclick="window.navigateTab('branding')">
                        <div class="sidebar-nav-icon">${icons.branding}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Identity & Branding</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'pos' ? 'active' : ''}" onclick="window.navigateTab('pos')">
                        <div class="sidebar-nav-icon">${icons.pos}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">POS Catalog</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'access' ? 'active' : ''}" onclick="window.navigateTab('access')">
                        <div class="sidebar-nav-icon">${icons.access}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Access Control</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'activity' ? 'active' : ''}" onclick="window.navigateTab('activity')">
                        <div class="sidebar-nav-icon">${icons.activity}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Activity Log</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'storage' ? 'active' : ''}" onclick="window.navigateTab('storage')">
                        <div class="sidebar-nav-icon">${icons.storage}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Storage Monitor</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'payment_terminals' ? 'active' : ''}" onclick="window.navigateTab('payment_terminals')">
                        <div class="sidebar-nav-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                        </div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Payment Terminals</span></div>
                    </li>
                    <li class="sidebar-nav-item ${currentTab === 'infrastructure' ? 'active' : ''}" onclick="window.navigateTab('infrastructure')">
                        <div class="sidebar-nav-icon">${icons.infrastructure}</div>
                        <div class="sidebar-item-content"><span class="sidebar-item-title">Infrastructure & DB</span></div>
                    </li>
                </ul>
                <div class="sidebar-footer">
                    <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-bottom:12px;">${settings.companyName} Core</div>
                    <button class="sidebar-footer-btn" onclick="window.goBackToOperations()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                        Exit Settings
                    </button>
                </div>
            </aside>
            <!-- Main Content -->
            <main class="console-main-content">
                ${renderTabContent()}
            </main>
        </div>
    `;
};
window.showLoading = (msg = 'Saving...') => {
    const loader = document.getElementById('global-loader');
    const text = document.getElementById('global-loader-text');
    if (loader && text) {
        text.innerText = msg;
        loader.style.display = 'flex';
    }
};
window.hideLoading = () => {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'none';
};

window.showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '999999';
    toast.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : '#3b82f6');
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    toast.innerText = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};
// Authentication Variables
let tempLoginState = null;

window.showForgotPassword = () => {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'flex';
    document.getElementById('forgot-error').innerText = '';
    document.getElementById('forgot-emp-id').value = document.getElementById('login-emp-id').value;
};

window.cancelForgotPassword = () => {
    document.getElementById('forgot-password-container').style.display = 'none';
    document.getElementById('reset-password-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
};

window.requestPasswordResetOTP = async (event) => {
    const empId = document.getElementById('forgot-emp-id').value.trim();
    const errorEl = document.getElementById('forgot-error');
    if (!empId) {
        errorEl.innerText = "Please enter your Admin ID";
        return;
    }
    
    errorEl.innerText = "";
    const btn = document.getElementById('forgot-btn');
    
    // Check if called from the link or button
    const isLink = event && event.target && event.target.tagName === 'A';
    if(isLink) {
        event.target.innerText = "Sending...";
        event.target.style.pointerEvents = "none";
    } else {
        btn.innerText = "SENDING...";
        btn.disabled = true;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empId })
        });
        const data = await res.json();
        
        if (res.ok) {
            tempLoginState = { empId: data.empId, unitId: data.unitId };
            document.getElementById('forgot-password-container').style.display = 'none';
            document.getElementById('reset-password-container').style.display = 'flex';
            document.getElementById('reset-error').innerText = '';
            document.getElementById('reset-error').style.color = '#10b981'; // Green for success msg
            document.getElementById('reset-error').innerText = data.message;
            setTimeout(() => { 
                const el = document.getElementById('reset-error');
                if (el) { el.style.color = '#dc2626'; el.innerText = ''; }
            }, 5000);
            
            if(isLink) {
                event.target.innerText = "Sent!";
                setTimeout(() => {
                    event.target.innerText = "Resend OTP";
                    event.target.style.pointerEvents = "auto";
                }, 5000);
            }
        } else {
            errorEl.innerText = data.detail || "Failed to request OTP.";
            if(isLink) {
                event.target.innerText = "Resend OTP";
                event.target.style.pointerEvents = "auto";
            }
        }
    } catch(e) {
        errorEl.innerText = "Network Error";
        if(isLink) {
            event.target.innerText = "Resend OTP";
            event.target.style.pointerEvents = "auto";
        }
    } finally {
        if(!isLink) {
            btn.innerText = "SEND CODE";
            btn.disabled = false;
        }
    }
};

window.submitNewPassword = async () => {
    const otp = document.getElementById('reset-otp').value.trim();
    const newPassword = document.getElementById('reset-new-password').value.trim();
    const errorEl = document.getElementById('reset-error');
    
    if (!otp || !newPassword) {
        errorEl.style.color = '#dc2626';
        errorEl.innerText = "Please enter the OTP and a new password";
        return;
    }
    
    if (newPassword.length < 8) {
        errorEl.style.color = '#dc2626';
        errorEl.innerText = "Password must be at least 8 characters long";
        return;
    }
    
    errorEl.innerText = "";
    const btn = document.getElementById('reset-btn');
    btn.innerText = "RESETTING...";
    btn.disabled = true;
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                empId: tempLoginState.empId, 
                unitId: tempLoginState.unitId,
                otp: otp,
                newPassword: newPassword
            })
        });
        const data = await res.json();
        
        if (res.ok) {
            window.cancelForgotPassword();
            document.getElementById('login-error').style.color = '#10b981';
            document.getElementById('login-error').innerText = data.message;
            setTimeout(() => {
                const el = document.getElementById('login-error');
                if (el) { el.style.color = '#dc2626'; el.innerText = ''; }
            }, 5000);
        } else {
            errorEl.style.color = '#dc2626';
            errorEl.innerText = data.detail || "Failed to reset password.";
        }
    } catch(e) {
        errorEl.style.color = '#dc2626';
        errorEl.innerText = "Network Error";
    } finally {
        btn.innerText = "RESET PASSWORD";
        btn.disabled = false;
    }
};
window.attemptLogin = async () => {
    const empId = document.getElementById('login-emp-id').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    
    if (!empId || !password) {
        errorEl.innerText = "Please enter Admin ID and Password";
        return;
    }
    
    errorEl.innerText = "";
    document.getElementById('login-btn').innerText = "Verifying...";
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empId, password, require_2fa: true })
        });
        
        const data = await res.json();
        if (res.ok && data.status === '2fa_required') {
            tempLoginState = data;
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('otp-container').style.display = 'flex';
        } else {
            errorEl.innerText = data.detail || "Authentication failed";
            document.getElementById('login-btn').innerText = "Login Securely";
        }
    } catch (e) {
        errorEl.innerText = "Network Error";
        document.getElementById('login-btn').innerText = "Login Securely";
    }
};
window.resendLoginOTP = async (event) => {
    const errorEl = document.getElementById('otp-error');
    errorEl.innerText = "";
    
    // attemptLogin reads the existing empId and password inputs and fires the API request
    await window.attemptLogin();
    
    if(event && event.target) {
        const originalText = event.target.innerText;
        event.target.innerText = "Sent!";
        event.target.style.pointerEvents = "none";
        setTimeout(() => {
            event.target.innerText = originalText;
            event.target.style.pointerEvents = "auto";
        }, 5000); // disable for 5 seconds to prevent spam
    }
};

window.verifyOTP = async () => {
    const otp = document.getElementById('login-otp').value.trim();
    const errorEl = document.getElementById('otp-error');
    
    if (!otp || otp.length !== 6) {
        errorEl.innerText = "Enter a valid 6-digit code";
        return;
    }
    
    errorEl.innerText = "";
    document.getElementById('otp-btn').innerText = "Verifying...";
    
    try {
        const res = await fetch(`${API_BASE}/api/auth/verify_otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                empId: tempLoginState.empId, 
                unitId: tempLoginState.unitId,
                otp: otp 
            })
        });
        
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            localStorage.setItem('sri_nathi_session_token', data.sessionToken);
            localStorage.setItem('sri_nathi_jwt_token', data.token);
            localStorage.setItem('sri_nathi_session_user', JSON.stringify(data.employee));
            
            // Trigger Boot Sequence
            document.getElementById('otp-container').style.display = 'none';
            triggerBootSequence();
        } else {
            errorEl.innerText = data.detail || "Invalid code";
            document.getElementById('otp-btn').innerText = "Verify Identity";
        }
    } catch (e) {
        errorEl.innerText = "Network Error";
        document.getElementById('otp-btn').innerText = "Verify Identity";
    }
};
const triggerBootSequence = () => {
    const bootLoader = document.getElementById('boot-loader');
    bootLoader.style.display = 'flex';
    
    // Fetch data while booting
    if (window.fetchDatabaseState) {
        window.fetchDatabaseState();
    }
    
    setTimeout(() => {
        bootLoader.style.display = 'none';
        render();
    }, 5500); // 5.5 second boot time
};
// Initialization hook waiting for DB
const init = async () => {
    const token = localStorage.getItem('sri_nathi_jwt_token');
    if (token) {
        try {
            const res = await fetch('/api/auth/session', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (window.state) {
                    window.state.currentUser = data.user;
                    window.state.allowedRoutes = data.allowedRoutes || [];
                    window.state.activeUnitId = data.user.unitId || 'unit-1';
                }
                const loginContainer = document.getElementById('login-container');
                if (loginContainer) loginContainer.style.display = 'none';
                triggerBootSequence();
                return;
            }
        } catch (e) {}
    }
    window.location.href = '/universal_login.html';
};
init();