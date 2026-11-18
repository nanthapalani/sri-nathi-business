import { getDB, saveDB, LAST_SYNC_STATE } from '/shared/db.js?v=14';
import { API_BASE } from './utils.js';

window.auditLogs = [];
window.rbacData = { roles: [], bindings: [] };
window.pendingRbacChange = null;
window.lastSyncTimestamp = null;
window.systemStatus = {
    storage: { used_bytes: 0 }
};

window.fetchAuditLogs = async () => {
    try {
        const token = localStorage.getItem('sri_nathi_jwt_token') || sessionStorage.getItem('sri_nathi_session_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/audit_logs`, { headers });
        const data = await res.json();
        window.auditLogs = Array.isArray(data) ? data : (data.logs || []);
    } catch(e) { console.error("Audit logs fetch error", e); }
};

window.fetchRbacData = async () => {
    try {
        const token = localStorage.getItem('sri_nathi_jwt_token') || sessionStorage.getItem('sri_nathi_session_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const [rolesRes, bindingsRes] = await Promise.all([
            fetch(`${API_BASE}/api/rbac/roles`, { headers }),
            fetch(`${API_BASE}/api/rbac/bindings`, { headers })
        ]);
        const rolesData = await rolesRes.json();
        const bindingsData = await bindingsRes.json();
        window.rbacData.roles = rolesData.roles || [];
        window.rbacData.bindings = bindingsData.bindings || [];
    } catch(e) { console.error("RBAC fetch error", e); }
};

window.fetchSystemStatus = async () => {
    try {
        const token = localStorage.getItem('sri_nathi_jwt_token') || sessionStorage.getItem('sri_nathi_session_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/system/status`, { headers });
        const data = await res.json();
        if (data.storage) window.systemStatus = data;
    } catch(e) { console.error("Status fetch error", e); }
};

// Calculate the REAL number of unsynced records by diffing local cache vs last-synced state
window.getUnsyncedCount = () => {
    const db = getDB();
    let count = 0;
    let unsyncedDetails = {};
    for (const key of Object.keys(db)) {
        const current = db[key];
        if (!Array.isArray(current)) continue;
        const synced = LAST_SYNC_STATE[key] || [];
        // Count modified or new items
        for (const item of current) {
            const prev = synced.find(s => s.id === item.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
                count++;
                unsyncedDetails[key] = (unsyncedDetails[key] || 0) + 1;
            }
        }
        // Count deleted items
        for (const prev of synced) {
            if (!current.find(c => c.id === prev.id)) {
                count++;
                unsyncedDetails[key] = (unsyncedDetails[key] || 0) + 1;
            }
        }
    }
    if (count > 0) {
        console.log("Unsynced Records Breakdown:", unsyncedDetails);
    }
    return count;
};

// Full 2-way sync: PUSH local changes → FLUSH offline queue → PULL latest from DB
export const syncBackend = async () => {
    console.log("[Sync] Starting full 2-way sync...");
    
    // Step 1: PUSH — save any local diffs to PostgreSQL
    const db = getDB();
    await saveDB(db);
    
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
window.syncBackend = syncBackend;

export const initSync = async () => {
    // One-time wipe of old offline fake records to ensure we show true values
    if (!localStorage.getItem('wiped_fake_records_v4')) {
        console.log("Wiping fake offline records deeply...");
        await new Promise((resolve) => {
            const req = indexedDB.open('SriNathiOfflineDB', 1);
            req.onsuccess = (e) => {
                try {
                    const db = e.target.result;
                    if (db.objectStoreNames.contains('offline_queue')) {
                        const tx = db.transaction('offline_queue', 'readwrite');
                        tx.objectStore('offline_queue').clear();
                        tx.oncomplete = () => { db.close(); resolve(); };
                        tx.onerror = () => { db.close(); resolve(); };
                    } else {
                        db.close(); resolve();
                    }
                } catch(err) { resolve(); }
            };
            req.onerror = () => resolve();
        });
        
        if (window.resetAppCache) {
            await window.resetAppCache();
        }
        localStorage.setItem('wiped_fake_records_v4', '1');
    }
    
    setInterval(window.syncBackend, 180000); // 3-minute auto-sync
    window.addEventListener('beforeunload', () => {
        // Push any pending local diffs before leaving
        const db = window.getDB ? window.getDB() : {};
        if (window.saveDB) window.saveDB(db);
        const API_BASE = "";
        navigator.sendBeacon(`${API_BASE}/api/audit_logs`, JSON.stringify({action: 'LOGOUT', details: 'User closed Business Console session'}));
    });
    setTimeout(window.syncBackend, 1000);
};
