// db.js - Centralized DB Engine & Simulators for Sri Nathi Platform
// Automatically unregister active service workers on localhost to prevent Vite HMR WebSocket breaks
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let r of registrations) r.unregister();
    });
}
const SecureStorage = window.SecureStorage || window.localStorage;
// Use relative paths so IIS proxy handles it (if port is empty, it's IIS on 80/443)
const API_BASE = "";
// Generate or retrieve Device ID
const getDeviceId = () => {
    let did = SecureStorage.getItem('sri_nathi_device_id');
    if (!did) {
        did = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
        SecureStorage.setItem('sri_nathi_device_id', did);
    }
    return did;
};
export const generateDeviceFingerprint = () => {
    let fp = sessionStorage.getItem('sri_nathi_client_fingerprint');
    if (fp) return fp;
    try {
        const components = [
            navigator.userAgent || '',
            navigator.language || '',
            Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            `${screen.width}x${screen.height}x${screen.colorDepth}`,
            navigator.hardwareConcurrency || '8',
            navigator.maxTouchPoints || '0'
        ].join('||');
        let hash = 5381;
        for (let i = 0; i < components.length; i++) {
            hash = ((hash << 5) + hash) + components.charCodeAt(i);
            hash = hash & hash;
        }
        fp = 'fp-zt-' + Math.abs(hash).toString(16) + '-' + (components.length * 31).toString(16);
    } catch(e) {
        fp = 'fp-zt-fallback-' + getDeviceId();
    }
    sessionStorage.setItem('sri_nathi_client_fingerprint', fp);
    return fp;
};
window.generateDeviceFingerprint = generateDeviceFingerprint;
const getUnitId = () => {
  const activeUnit = SecureStorage.getItem('sri_nathi_active_unit');
  if (activeUnit) return activeUnit;
  const adminUser = SecureStorage.getItem('sri_nathi_session_user');
  if (adminUser) {
    try {
      const parsed = JSON.parse(adminUser);
      if (parsed && (parsed.role === 'admin' || parsed.role === 'top management' || parsed.role === 'management' || parsed.isMgmt || !parsed.assignedUnitId)) {
        return 'ALL';
      }
      if (parsed && (parsed.assignedUnitId || parsed.unitId)) {
        return parsed.assignedUnitId || parsed.unitId;
      }
    } catch(e) {}
  }
  const customerUser = SecureStorage.getItem('sri_nathi_session_customer');
  if (customerUser) {
    try {
      const parsed = JSON.parse(customerUser);
      if (parsed && parsed.mappedUnitId) {
        return parsed.mappedUnitId;
      }
    } catch(e) {}
  }
  return 'unit-1';
};
const get_allowed_keys_for_current_origin = () => {
  const hostname = window.location.hostname.toLowerCase();
  const port = window.location.port;
  if (port === "8001" || hostname.includes("customer")) {
    return ["customers", "catering_orders", "menu", "reviews", "units"];
  } else if (port === "8002" || hostname.includes("fin.")) {
    return ["vendors", "utility_bills", "expenses", "invoices", "menu", "units", "payroll_ledger"];
  } else if (port === "8003" || hostname.includes("hrms.")) {
    return [
      "employees", "hr_requests", "customers", "units", "payroll_ledger",
      "menu", "invoices", "catering_orders", "inventory", "compliance_licenses",
      "vendors", "utility_bills", "expenses", "aggregator_orders",
      "business_settings", "audit_logs", "storage", "pos_table_sessions"
    ];
  } else if (port === "8004" || hostname.includes("customer-hub")) {
    return ["customers", "reviews", "enquiries", "units", "catering_orders"];
  } else {
    // Operations Portal (port 8000) has full access
    return [
      "units", "employees", "hr_requests", "menu", "vehicles", 
      "customers", "catering_orders", "invoices", "audit_logs", 
      "inventory", "compliance_licenses", "utility_bills", "expenses", 
      "vendors", "payroll_ledger", "pos_table_sessions", "aggregator_orders",
      "business_settings", "storage"
    ];
  }
};

// ==========================================
// TOP-LEVEL ENCRYPTION MIDDLEWARE
// ==========================================
export const EncryptionMiddleware = {
  getSecretKey() {
    return SecureStorage.getItem('sri_nathi_e2ee_secret') || "sri_nathi_secure_master_password";
  },
  sensitiveFieldsSchema: {
    customers: ['mobile', 'email', 'address', 'gstNumber', 'referralMobile'],
    employees: ['mobile', 'email', 'salary', 'bankAccount', 'panNumber'],
    hr_requests: ['currentSalary', 'requestedSalary', 'bankAccount'],
    compliance_licenses: ['licenseNumber', 'documentUrl'],
    catering_orders: ['referralMobile', 'specialNotes']
  },
  async encryptRecord(collectionKey, record) {
    if (!record || typeof record !== 'object' || !window.e2eEncrypt) return record;
    const fields = this.sensitiveFieldsSchema[collectionKey];
    if (!fields || !fields.length) return record;
    
    const e2ePassword = this.getSecretKey();
    const clone = Object.assign({}, record);
    for (const field of fields) {
      if (clone[field] && typeof clone[field] === 'string' && !clone[field].startsWith('E2EE::')) {
        clone[field] = await window.e2eEncrypt(clone[field], e2ePassword);
      }
    }
    return clone;
  },
  async decryptRecord(collectionKey, record) {
    if (!record || typeof record !== 'object' || !window.e2eDecrypt) return record;
    const fields = this.sensitiveFieldsSchema[collectionKey];
    if (!fields || !fields.length) return record;
    
    const e2ePassword = this.getSecretKey();
    const clone = Object.assign({}, record);
    for (const field of fields) {
      if (clone[field] && typeof clone[field] === 'string' && clone[field].startsWith('E2EE::')) {
        clone[field] = await window.e2eDecrypt(clone[field], e2ePassword);
      }
    }
    return clone;
  },
  async encryptDataset(collectionKey, datasetArray) {
    if (!Array.isArray(datasetArray) || !window.e2eEncrypt) return datasetArray;
    const fields = this.sensitiveFieldsSchema[collectionKey];
    if (!fields || !fields.length) return datasetArray;
    
    return await Promise.all(datasetArray.map(item => this.encryptRecord(collectionKey, item)));
  },
  async decryptDataset(collectionKey, datasetArray) {
    if (!Array.isArray(datasetArray) || !window.e2eDecrypt) return datasetArray;
    const fields = this.sensitiveFieldsSchema[collectionKey];
    if (!fields || !fields.length) return datasetArray;
    
    return await Promise.all(datasetArray.map(item => this.decryptRecord(collectionKey, item)));
  }
};
window.EncryptionMiddleware = EncryptionMiddleware;

export function isJwtExpired(token) {
  if (!token || typeof token !== 'string' || token === 'undefined' || token === 'null') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonStr);
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}
window.isJwtExpired = isJwtExpired;

export const getActiveAuthToken = () => {
  return (typeof SecureStorage !== 'undefined' && SecureStorage.getItem ? SecureStorage.getItem('sri_nathi_jwt_token') : null) ||
         localStorage.getItem('sri_nathi_jwt_token') ||
         sessionStorage.getItem('sri_nathi_jwt_token') ||
         (typeof SecureStorage !== 'undefined' && SecureStorage.getItem ? SecureStorage.getItem('sri_nathi_token') : null) ||
         localStorage.getItem('sri_nathi_token');
};

export const hasActiveUser = () => {
  const user = (typeof SecureStorage !== 'undefined' && SecureStorage.getItem ? SecureStorage.getItem('sri_nathi_session_user') : null) ||
               localStorage.getItem('sri_nathi_session_user') ||
               sessionStorage.getItem('sri_nathi_session_user');
  return (user && user !== 'undefined' && user !== 'null') ? user : null;
};

// ==========================================
// TOP-LEVEL SECURE API CONNECTOR (GATEWAY)
// ==========================================
export const SecureAPIConnector = {
  getHeaders(method = 'GET', url = '', body = '') {
    const token = getActiveAuthToken();
    const sessionToken = (typeof SecureStorage !== 'undefined' && SecureStorage.getItem ? SecureStorage.getItem('sri_nathi_session_token') : null) || localStorage.getItem('sri_nathi_session_token');
    
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Id': getDeviceId(),
      'X-Client-Fingerprint': generateDeviceFingerprint(),
      'X-Request-Timestamp': timestamp,
      'X-Request-Nonce': nonce
    };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (sessionToken) headers['X-Session-Token'] = sessionToken;
    
    // HMAC Request Signing (if CryptoJS is available)
    if (window.CryptoJS) {
        try {
            const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
            const bodyHash = CryptoJS.SHA256(bodyStr).toString();
            // In a real scenario, this secret should be securely exchanged. We use sessionToken or a static salt.
            const hmacSecret = sessionToken || 'sri_nathi_default_hmac_secret';
            const payload = `${method}|${url}|${timestamp}|${nonce}|${bodyHash}`;
            const signature = CryptoJS.HmacSHA256(payload, hmacSecret).toString();
            headers['X-Request-Signature'] = signature;
        } catch(e) { console.error("HMAC signing failed", e); }
    } else {
        console.error("CryptoJS is NOT available! Cannot generate X-Request-Signature.");
    }
    
    return headers;
  },
  handleAuthExpiry() {
    if (window._authExpiryHandled) return;
    window._authExpiryHandled = true;
    console.warn("[SecureAPIConnector] Session expired or invalid. Purging credentials and redirecting to login.");
    
    // Purge expired tokens and cached user
    const keys = [
      'sri_nathi_jwt_token',
      'sri_nathi_token',
      'sri_nathi_session_token',
      'sri_nathi_session_user',
      'sri_nathi_session_locked',
      'sri_nathi_last_activity'
    ];
    keys.forEach(k => {
      try { localStorage.removeItem(k); } catch(_) {}
      try { sessionStorage.removeItem(k); } catch(_) {}
      try { if (window.SecureStorage) window.SecureStorage.removeItem(k); } catch(_) {}
    });

    try {
      document.cookie = "sri_nathi_jwt_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      document.cookie = "sri_nathi_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
    } catch(_) {}

    if (typeof window !== 'undefined' && !window.location.pathname.includes('universal_login')) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      try { sessionStorage.setItem('sri_nathi_valid_login_path', '/universal_login.html'); } catch(_) {}
      window.location.replace(`/universal_login.html?portal=operations&expired=1&returnUrl=${returnUrl}`);
    }
  },
  async fetch(url, options = {}) {
    if (window._authExpiryHandled) return null;
    const fullUrl = (typeof url === 'string' && url.startsWith('/') && API_BASE) ? `${API_BASE}${url}` : url;
    const method = options.method || 'GET';
    const body = options.body || '';
    const generatedHeaders = this.getHeaders(method, fullUrl, body);
    const headers = { ...generatedHeaders, ...(options.headers || {}) };
    try {
      const res = await fetch(fullUrl, { ...options, headers });
      if (res.status === 401 && !fullUrl.includes('/api/auth/')) {
        this.handleAuthExpiry();
      }
      return res;
    } catch (err) {
      if (!fullUrl.includes('/api/auth/')) {
        const token = getActiveAuthToken();
        if (!token || isJwtExpired(token)) {
          this.handleAuthExpiry();
          return null;
        }
      }
      throw err;
    }
  },
  async get(collectionKey, unitId) {
    if (window._authExpiryHandled) return null;
    if (typeof collectionKey === 'string' && (collectionKey.startsWith('/') || collectionKey.startsWith('http'))) {
      return await this.fetch(collectionKey);
    }
    const targetUrl = `${API_BASE}/api/get?key=${collectionKey}&unitId=${unitId}`;
    try {
      const res = await fetch(targetUrl, {
        headers: this.getHeaders('GET', targetUrl)
      });
      if (res.status === 401) {
        console.warn(`[SecureAPIConnector] 401 Unauthorized for ${collectionKey}. Session expired.`);
        this.handleAuthExpiry();
        return null;
      }
      if (res.status !== 200) {
        console.warn(`[SecureAPIConnector] Non-200 GET for ${collectionKey}: ${res.status}`);
        return null;
      }
      const rawData = await res.json();
      return await EncryptionMiddleware.decryptDataset(collectionKey, rawData);
    } catch (err) {
      console.warn(`[SecureAPIConnector] Network/access failure for ${collectionKey}:`, err);
      // In Safari/WebKit, an expired token or 401 on fetch with credentials causes 'TypeError: Load failed'
      const token = getActiveAuthToken();
      if (!token || isJwtExpired(token)) {
        this.handleAuthExpiry();
        return null;
      }
      const errMsg = String(err && err.message ? err.message : err);
      if (errMsg.includes('Load failed') || errMsg.includes('access control')) {
        this._loadFailCount = (this._loadFailCount || 0) + 1;
        if (this._loadFailCount >= 2) {
          console.warn("[SecureAPIConnector] Repeated access check / load failures. Expiring session.");
          this.handleAuthExpiry();
          return null;
        }
      }
      throw err;
    }
  },
  async upsert(collectionKey, unitId, payloadArray) {
    const encryptedPayload = await EncryptionMiddleware.encryptDataset(collectionKey, payloadArray);
    const url = `${API_BASE}/api/upsert?key=${collectionKey}&unitId=${unitId}`;
    return await fetch(url, {
      method: 'POST',
      headers: this.getHeaders('POST', url, encryptedPayload),
      body: JSON.stringify(encryptedPayload)
    });
  },
  async delete(collectionKey, id, unitId = '') {
    const unitParam = unitId ? `&unitId=${encodeURIComponent(unitId)}` : '';
    const url = `${API_BASE}/api/delete?key=${encodeURIComponent(collectionKey)}&id=${encodeURIComponent(id)}${unitParam}`;
    const headers = this.getHeaders('DELETE', url);
    delete headers['Content-Type']; // DELETE requests don't need Content-Type body header
    return await fetch(url, {
      method: 'DELETE',
      headers: headers
    });
  },
  async fetchArchivedData(collectionKey, unitId) {
    const url = `${API_BASE}/api/archive/${encodeURIComponent(collectionKey)}?unitId=${encodeURIComponent(unitId)}`;
    const res = await fetch(url, { headers: this.getHeaders('GET', url) });
    if (!res.ok) {
      console.warn(`[SecureAPIConnector] Non-200 GET for archive ${collectionKey}: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.data || [];
  },
  async triggerBackendSync(unitId, scope = 'current') {
    const url = `${API_BASE}/api/sync/trigger`;
    const payload = { unit_id: unitId, scope: scope };
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders('POST', url, payload),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Backend Sync Failed: ${res.status}`);
    return await res.json();
  },
  async hardDelete(collectionKey, id, unitId) {
    const url = `${API_BASE}/api/archive/${encodeURIComponent(collectionKey)}/${encodeURIComponent(id)}?unitId=${encodeURIComponent(unitId)}`;
    const headers = this.getHeaders('DELETE', url);
    delete headers['Content-Type'];
    return await fetch(url, { method: 'DELETE', headers });
  },
  async restoreRecord(collectionKey, id, unitId) {
    const url = `${API_BASE}/api/archive/${encodeURIComponent(collectionKey)}/${encodeURIComponent(id)}/restore?unitId=${encodeURIComponent(unitId)}`;
    return await fetch(url, { method: 'POST', headers: this.getHeaders('POST', url) });
  },
  async login(usernameOrEmail, password, targetPortal) {
    return await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'X-Device-Id': getDeviceId(),
        'X-Client-Fingerprint': generateDeviceFingerprint()
      },
      body: JSON.stringify({ empId: usernameOrEmail, password, targetPortal: targetPortal || 'operations', clientFingerprint: generateDeviceFingerprint() })
    });
  },
  async getArchiveManifest(entity, unitId) {
    const res = await fetch(`${API_BASE}/api/archives/manifest?entity=${encodeURIComponent(entity)}&unitId=${encodeURIComponent(unitId)}`, {
      headers: this.getHeaders('GET')
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async retrieveArchive(entity, period, unitId) {
    const res = await fetch(`${API_BASE}/api/archives/retrieve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ entity, period, unitId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || 'Retrieval failed');
    return await EncryptionMiddleware.decryptDataset(entity, result.data || []);
  },
  async getArchiveQuota() {
    const res = await fetch(`${API_BASE}/api/archives/quota`, {
      headers: this.getHeaders('GET')
    });
    if (!res.ok) return { current: 0, max: 50 };
    return await res.json();
  }
};
window.SecureAPIConnector = SecureAPIConnector;

// Initialize Offline IndexedDB Queue
const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SriNathiOfflineDB', 2);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
const addToOfflineQueue = async (action, key, data) => {
  try {
    const db = await initIndexedDB();
    if (!db.objectStoreNames.contains('offline_queue')) return;
    const tx = db.transaction('offline_queue', 'readwrite');
    const store = tx.objectStore('offline_queue');
    store.add({ action, key, data, timestamp: Date.now() });
    // Show offline indicator
    document.body.classList.add('app-offline');
    if (!document.getElementById('offline-banner')) {
      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText = 'position:fixed; top:0; left:0; width:100%; z-index:9999; background:#ef4444; color:#fff; text-align:center; padding:10px; font-weight:700; transition:opacity 0.3s;';
      banner.innerText = 'You are offline. Changes will sync when connection is restored.';
      document.body.appendChild(banner);
    }
  } catch (e) {
    // Suppress offline queue error logs
  }
};
const flushOfflineQueue = async () => {
  document.body.classList.remove('app-offline');
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.background = '#10b981';
    banner.innerText = '✅ Back online. Syncing...';
    setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 300);
    }, 2000);
  }
  try {
    const db = await initIndexedDB();
    if (!db.objectStoreNames.contains('offline_queue')) return;
    const tx = db.transaction('offline_queue', 'readonly');
    const store = tx.objectStore('offline_queue');
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const queue = request.result;
      if (queue.length === 0) return;
      
      for (const item of queue) {
        // Re-attempt saveDB logic for these items
      }
      
      // We will actually just let the normal saveDB diffing catch it since the local cache is already updated,
      // but wait, if the user reloaded the page while offline, the local cache is empty?
      // Actually, if offline, getDB fails, so local cache relies on service worker caching the last known state.
      // We need to replay the queue against the server.
      
      const currentUnitId = getUnitId();
      
      for (const item of queue) {
         try {
             let itemSuccess = false;
             let shouldRemove = false;
             if (item.action === 'upsert') {
                 const res = await SecureAPIConnector.upsert(item.key, currentUnitId, item.data);
                 if (res && (res.ok || res.status === 200)) {
                     itemSuccess = true;
                     shouldRemove = true;
                 } else if (res && (res.status === 422 || res.status === 400 || res.status === 403)) {
                     console.warn(`[Offline Sync] Removing unprocessable item (${res.status}) for ${item.key}`);
                     shouldRemove = true;
                 }
             } else if (item.action === 'delete') {
                 const res = await SecureAPIConnector.delete(item.key, item.data, currentUnitId);
                 if (res && (res.ok || res.status === 200)) {
                     itemSuccess = true;
                     shouldRemove = true;
                 } else if (res && (res.status === 422 || res.status === 400 || res.status === 403)) {
                     shouldRemove = true;
                 }
             }
             
             if (shouldRemove) {
                 const deleteTx = db.transaction('offline_queue', 'readwrite');
                 deleteTx.objectStore('offline_queue').delete(item.id);
             }
         } catch(e) {
             console.error("[Offline Sync] Error flushing item:", e);
         }
      }
    };
  } catch (e) {
    console.error('Failed to flush Offline Queue:', e);
  }
};
window.addEventListener('online', flushOfflineQueue);
const allowedKeys = get_allowed_keys_for_current_origin();
const LOCAL_DB_CACHE = {};
const LAST_SYNC_STATE = {}; // For diffing
// Pre-populate cache with empty arrays unconditionally so sync access doesn't throw undefined errors
for (const key of allowedKeys) {
    if (typeof LOCAL_DB_CACHE[key] === 'undefined') {
        LOCAL_DB_CACHE[key] = [];
        LAST_SYNC_STATE[key] = [];
    }
}
const activeUnitId = getUnitId();
// Phase 4: Data Fetching and Synchronization
const applyOfflineQueueToCache = () => {
  return new Promise(async (resolve) => {
    try {
      const db = await initIndexedDB();
      if (!db.objectStoreNames.contains('offline_queue')) {
        resolve();
        return;
      }
      const tx = db.transaction('offline_queue', 'readonly');
      const store = tx.objectStore('offline_queue');
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        const items = getAll.result || [];
        for (const item of items) {
          if (item.action === 'upsert' && LOCAL_DB_CACHE[item.key]) {
            const dataArr = Array.isArray(item.data) ? item.data : [item.data];
            for (const u of dataArr) {
              if (!u) continue;
              const existingIdx = LOCAL_DB_CACHE[item.key].findIndex(x => x.id === u.id);
              if (existingIdx >= 0) LOCAL_DB_CACHE[item.key][existingIdx] = u;
              else LOCAL_DB_CACHE[item.key].push(u);
            }
          } else if (item.action === 'delete' && LOCAL_DB_CACHE[item.key]) {
            LOCAL_DB_CACHE[item.key] = LOCAL_DB_CACHE[item.key].filter(x => x.id !== item.data);
          }
        }
        resolve();
      };
      getAll.onerror = () => resolve();
    } catch(e) {
      console.error("Error applying offline queue", e);
      resolve();
    }
  });
};

window.fetchDatabaseState = async () => {
  if (window._authExpiryHandled) return;

  const token = getActiveAuthToken();
  const user = hasActiveUser();
  if (user && (!token || isJwtExpired(token))) {
    console.warn("[DB] fetchDatabaseState: Token expired or missing. Halting sync and expiring session.");
    SecureAPIConnector.handleAuthExpiry();
    return;
  }

  if (typeof flushOfflineQueue === 'function') {
    await flushOfflineQueue();
  }
  for (const key of allowedKeys) {
    if (window._authExpiryHandled) break;
    try {
      const data = await SecureAPIConnector.get(key, activeUnitId);
      if (window._authExpiryHandled) break;
      if (data !== null) {
        LOCAL_DB_CACHE[key] = data;
        LAST_SYNC_STATE[key] = JSON.parse(JSON.stringify(data)); // Deep clone for diffing
      } else {
        LOCAL_DB_CACHE[key] = [];
        LAST_SYNC_STATE[key] = [];
      }
    } catch (e) {
      if (window._authExpiryHandled) break;
      console.error(`Failed to fetch key ${key}:`, e);
      LOCAL_DB_CACHE[key] = [];
      LAST_SYNC_STATE[key] = []; // Missing sync state on catch
    }
  }
  if (window._authExpiryHandled) return;
  await applyOfflineQueueToCache();
  if (typeof window.render === "function") window.render();
};
window.resetAppCache = async () => {
  try {
    indexedDB.deleteDatabase('SriNathiOfflineDB');
  } catch(e) {}
  for (const key of allowedKeys) {
    if (key !== 'units') {
      LOCAL_DB_CACHE[key] = [];
      LAST_SYNC_STATE[key] = [];
    }
  }
};
export const fetchDatabaseState = window.fetchDatabaseState;
// Initial Data Load (Only if logged in and not an isolated single-page popup)
const isIsolatedPopup = typeof window !== 'undefined' && (
    window.location.search.includes('sid=') || 
    window.location.hash.includes('events_directory') ||
    (window.opener && window.location.hash.includes('events_directory'))
);

const startupToken = getActiveAuthToken();
const startupUser = hasActiveUser();

if (startupUser && (!startupToken || isJwtExpired(startupToken))) {
  console.warn("[DB] Found cached session with expired or missing token. Evicting stale credentials.");
  SecureAPIConnector.handleAuthExpiry();
} else if (!isIsolatedPopup && (startupToken || startupUser || SecureStorage.getItem('sri_nathi_session_token') || SecureStorage.getItem('sri_nathi_session_customer'))) {
  if (typeof window.fetchDatabaseState === 'function') {
      window.fetchDatabaseState().catch(e => console.error("Initial DB fetch failed", e));
  } else {
      console.warn("fetchDatabaseState not defined yet; deferring fetch.");
  }
} else {
  // Populate cache with empty arrays so the app can render safely before login
  for (const key of allowedKeys) {
    LOCAL_DB_CACHE[key] = [];
    LAST_SYNC_STATE[key] = [];
  }
}
// Phase 5: Real-Time WebSocket Synchronization
let _activeWs = null;
let _wsPingTimer = null;
let _wsReconnectTimer = null;

const initWebSocket = () => {
  if (_activeWs && (_activeWs.readyState === WebSocket.OPEN || _activeWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (_wsPingTimer) {
    clearInterval(_wsPingTimer);
    _wsPingTimer = null;
  }
  if (_wsReconnectTimer) {
    clearTimeout(_wsReconnectTimer);
    _wsReconnectTimer = null;
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let wsHost = window.location.host;
  // If running on dev server port 3000, connect directly to FastAPI WebSocket on port 8000
  if (window.location.port === '3000') {
    wsHost = `${window.location.hostname}:8000`;
  }
  
  try {
    const token = SecureStorage.getItem('sri_nathi_jwt_token');
    const authQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/sync${authQuery}`);
    _activeWs = ws;

    ws.onopen = () => {
      console.log("[Sync] Real-time synchronization active.");
      try {
        ws.send("ping");
      } catch (_) {}

      // Keepalive heartbeat every 20s to prevent IIS ARR / Cloudflare proxy idle termination
      _wsPingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send("ping");
          } catch (e) {
            console.warn("[Sync] Heartbeat ping failed:", e);
          }
        }
      }, 20000);
    };

    ws.onmessage = async (event) => {
      try {
        if (event.data === 'pong') return;
        if (event.data === 'ping') {
          try { ws.send('pong'); } catch (_) {}
          return;
        }

        const msg = JSON.parse(event.data);
        if (msg.type === 'pong') return;
        
        if (msg.type === 'NEW_DELIVERY_ORDER' || msg.type === 'DELIVERY_STATUS_UPDATED') {
          if (window.fetchActiveDeliveryOrders) window.fetchActiveDeliveryOrders();
          return;
        }
        if (msg.type === 'CATERING_EVENT_UPDATED') {
          if (msg.data && Array.isArray(LOCAL_DB_CACHE['catering_orders'])) {
            const incoming = msg.data;
            const norm = {
              ...incoming,
              unitId: incoming.unitId || incoming.unit_id,
              eventDate: incoming.eventDate || incoming.event_date,
              mealSlot: incoming.mealSlot || incoming.session || incoming.custom_requirements?.time_slot || '',
              venue: incoming.venue || incoming.hall || incoming.custom_requirements?.venue || '',
              eventType: incoming.eventType || incoming.custom_requirements?.event_name || 'Catering Event',
              customerName: incoming.customerName || incoming.custom_requirements?.customer_name || '',
              customerPhone: incoming.customerPhone || incoming.custom_requirements?.customer_phone || '',
              guestCount: parseInt(incoming.guestCount || incoming.guest_count || 0, 10)
            };
            const idx = LOCAL_DB_CACHE['catering_orders'].findIndex(x => x.id === norm.id);
            if (idx >= 0) LOCAL_DB_CACHE['catering_orders'][idx] = { ...LOCAL_DB_CACHE['catering_orders'][idx], ...norm };
            else LOCAL_DB_CACHE['catering_orders'].unshift(norm);
          }
          window.dispatchEvent(new CustomEvent('db_sync_updated', { detail: { key: 'catering_orders', action: 'upsert', payload: msg.data ? [msg.data] : [] } }));
          return;
        }
        if (msg.type === 'POS_TABLE_SESSION_SYNC') {
          const state = window.state;
          if (state && state.pos && state.pos.tableSessions) {
            if (msg.session) state.pos.tableSessions[msg.table] = msg.session;
            else delete state.pos.tableSessions[msg.table];
            if (state.pos.currentView === 'floor' && window.render) window.render();
          }
          return;
        }
        if (msg.type === 'KOT_DISPATCH') {
          const kot = msg.data;
          if (window.showToastNotification || window.showToast) {
            (window.showToastNotification || window.showToast)({
              message: `KOT ${kot.kot_number} dispatched for ${kot.table_number}`,
              type: 'info'
            });
          }
          return;
        }
        if (msg.type === 'POS_BILL_VOIDED') {
          if (window.showToastNotification || window.showToast) {
            (window.showToastNotification || window.showToast)({
              message: `Invoice ${msg.invoice_id} VOIDED by manager`,
              type: 'warning'
            });
          }
          if (window.render) window.render();
          return;
        }
        if (msg.type === 'MENU_AVAILABILITY_CHANGED') {
          const db = window.getDB ? window.getDB() : {};
          if (db.menu) {
            const m = db.menu.find(x => x.id === msg.item_id);
            if (m) m.active = msg.active;
          }
          if (window.render) window.render();
          return;
        }
        if (msg.action === 'force_sync') {
          if (typeof flushOfflineQueue === 'function') {
            flushOfflineQueue();
          }
          return;
        }
        
        const key = msg.key;
        if (!LOCAL_DB_CACHE[key]) return;
        
        if (msg.action === 'upsert' && msg.payload) {
          let payload = await EncryptionMiddleware.decryptDataset(key, msg.payload);
          
          for (const incomingItem of payload) {
            const idx = LOCAL_DB_CACHE[key].findIndex(x => x.id === incomingItem.id);
            if (idx >= 0) LOCAL_DB_CACHE[key][idx] = incomingItem;
            else LOCAL_DB_CACHE[key].push(incomingItem);
            
            // Update Sync State so we don't reflect it back
            const syncIdx = LAST_SYNC_STATE[key].findIndex(x => x.id === incomingItem.id);
            if (syncIdx >= 0) LAST_SYNC_STATE[key][syncIdx] = JSON.parse(JSON.stringify(incomingItem));
            else LAST_SYNC_STATE[key].push(JSON.parse(JSON.stringify(incomingItem)));
          }
          
        } else if (msg.action === 'delete' && msg.id) {
          LOCAL_DB_CACHE[key] = LOCAL_DB_CACHE[key].filter(x => x.id !== msg.id);
          LAST_SYNC_STATE[key] = LAST_SYNC_STATE[key].filter(x => x.id !== msg.id);
        } else if (msg.action === 'pos_eod') {
          window.dispatchEvent(new CustomEvent('db_sync_updated', { detail: { key: 'pos_eod', action: 'pos_eod', payload: msg.payload } }));
          return;
        }
        
        // Notify the UI to re-render
        window.dispatchEvent(new CustomEvent('db_sync_updated', { detail: { key, action: msg.action, payload: msg.payload } }));
        
      } catch (e) {
        console.error("[WebSocket] Failed to process sync message:", e);
      }
    };

    ws.onerror = (err) => {
      console.warn("[Sync] Stream issue observed:", err);
    };

    ws.onclose = (event) => {
      if (_wsPingTimer) {
        clearInterval(_wsPingTimer);
        _wsPingTimer = null;
      }
      _activeWs = null;
      console.warn(`[Sync] Real-time stream closed (code: ${event.code || 'unknown'}). Reconnecting in 5s...`);
      _wsReconnectTimer = setTimeout(initWebSocket, 5000);
    };
  } catch (err) {
    console.error("[WebSocket] Failed to initialize WebSocket:", err);
    _wsReconnectTimer = setTimeout(initWebSocket, 5000);
  }
};
initWebSocket();
export const getDB = () => {
  return LOCAL_DB_CACHE;
};
export const saveDB = async (db) => {
  const currentUnitId = getUnitId();
  const token = SecureStorage.getItem('sri_nathi_jwt_token');
  const sessionToken = SecureStorage.getItem('sri_nathi_session_token');
  const headers = { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (sessionToken) headers['X-Session-Token'] = sessionToken;
  // Background differential synchronization
  for (const key of allowedKeys) {
    if (!LOCAL_DB_CACHE[key] || !LAST_SYNC_STATE[key]) continue;
    
    const currentList = LOCAL_DB_CACHE[key];
    const previousList = LAST_SYNC_STATE[key];
    
    if (!Array.isArray(currentList) || !Array.isArray(previousList)) {
      continue;
    }
    
    const currentMap = new Map(currentList.map(i => [i.id, i]));
    const previousMap = new Map(previousList.map(i => [i.id, i]));
    
    const upserts = [];
    const deletes = [];
    
    // Find UPSERTS (new or modified)
    for (const item of currentList) {
      const prev = previousMap.get(item.id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
        upserts.push(JSON.parse(JSON.stringify(item))); // clone
      }
    }
    
    // Find DELETES
    for (const prev of previousList) {
      if (!currentMap.has(prev.id)) {
        deletes.push(prev.id);
      }
    }
    
    if (upserts.length === 0 && deletes.length === 0) {
      continue; // Nothing changed for this key
    }
    
    const syncPromises = [];
    
    // Process Upserts via Top-Level SecureAPIConnector
    if (upserts.length > 0) {
      syncPromises.push(SecureAPIConnector.upsert(key, currentUnitId, upserts).then(res => {
        if(res && res.ok) {
           // Update sync state if successful
           for(const u of upserts) {
             const existingIdx = LAST_SYNC_STATE[key].findIndex(x => x.id === u.id);
             if(existingIdx >= 0) LAST_SYNC_STATE[key][existingIdx] = currentMap.get(u.id);
             else LAST_SYNC_STATE[key].push(currentMap.get(u.id));
           }
        } else {
           addToOfflineQueue('upsert', key, upserts);
        }
      }).catch(e => {
          console.error(`Failed to upsert key ${key}, saving to offline queue:`, e);
          addToOfflineQueue('upsert', key, upserts);
      }));
    }

    // Process Deletes via Top-Level SecureAPIConnector
    for (const delId of deletes) {
      syncPromises.push(SecureAPIConnector.delete(key, delId, currentUnitId).then(res => {
         if(res && res.ok) {
            LAST_SYNC_STATE[key] = LAST_SYNC_STATE[key].filter(x => x.id !== delId);
         } else {
            addToOfflineQueue('delete', key, delId);
         }
      }).catch(e => {
          console.error(`Failed to delete key ${key} ID ${delId}, saving to offline queue:`, e);
          addToOfflineQueue('delete', key, delId);
      }));
    }
    
    await Promise.all(syncPromises);
  }
};
export const initDB = () => {
  return LOCAL_DB_CACHE;
};
// Log Audit Action
export const logAudit = (userId, unitId, action, details) => {
  const db = getDB();
  if (!db.audit_logs) {
    db.audit_logs = [];
  }
  const newLog = {
    id: "log-" + Date.now(),
    timestamp: new Date().toISOString(),
    userId,
    unitId,
    action,
    details
  };
  db.audit_logs.unshift(newLog);
  saveDB(db);
};
// --- POS BILLING API ---
export const createInvoice = (invoiceData) => {
  const db = getDB();
  const units = db.units || [];
  const unit = units.find(u => u && u.id === invoiceData.unitId);
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `INV-${unit && unit.code ? unit.code : 'GEN'}-${dateStr}`;
  if (!db.invoices) db.invoices = [];
  const unitInvoices = db.invoices.filter(inv => inv && inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix));
  const runningNum = String(unitInvoices.length + 1).padStart(4, '0');
  const invoiceNumber = `${prefix}-${runningNum}`;
  const newInvoice = {
    id: "inv-" + Date.now(),
    invoiceNumber,
    timestamp: new Date().toISOString(),
    status: "Paid",
    ...invoiceData
  };
  db.invoices.push(newInvoice);
  saveDB(db);
  logAudit(invoiceData.cashierId, invoiceData.unitId, "NEW_POS_BILL", `Billed invoice ${invoiceNumber} for Total: ₹${invoiceData.totalAmount}`);
  return newInvoice;
};
export const voidInvoice = (invoiceId, cashierId, unitId, reason) => {
  const db = getDB();
  const invoiceIndex = db.invoices.findIndex(inv => inv.id === invoiceId);
  if (invoiceIndex !== -1) {
    db.invoices[invoiceIndex].status = "Void";
    db.invoices[invoiceIndex].voidReason = reason;
    saveDB(db);
    logAudit(cashierId, unitId, "VOID_POS_BILL", `Voided invoice ${db.invoices[invoiceIndex].invoiceNumber}. Reason: ${reason}`);
    return true;
  }
  return false;
};
// --- CUSTOMER API ---
export const createCustomer = (customerData) => {
  const db = getDB();
  
  const newCustomer = {
    id: "cust-" + Date.now(),
    name: customerData.name || "",
    mobile: customerData.mobile || "",
    alternateMobile: customerData.alternateMobile || "",
    address: customerData.address || "",
    notes: customerData.notes || "",
    mappedUnitId: customerData.mappedUnitId || getUnitId(),
    latitude: 10.9601,
    longitude: 78.0766,
    createdAt: new Date().toISOString().split('T')[0],
    lastLoginDate: "",
    status: "active",
    ...customerData
  };
  if (!db.customers) db.customers = [];
  db.customers.push(newCustomer);
  saveDB(db);
  
  logAudit(customerData.createdById || "SYSTEM", newCustomer.mappedUnitId, "NEW_CUSTOMER", `Customer created: ${newCustomer.mobile}`);
  return newCustomer;
};
// --- CATERING FLOW API ---
export const createCateringOrder = (orderData) => {
  const db = getDB();
  
  // Custom Serial Number Logic
  const unitId = orderData.unitId || 'unit-2'; // default Namakkal
  let locationCode = 'GEN';
  if (unitId === 'unit-1') locationCode = 'KRR';
  else if (unitId === 'unit-2') locationCode = 'NK';
  else if (unitId === 'unit-3') locationCode = 'SLM';
  else if (unitId === 'unit-4') locationCode = 'ERD';
  else if (unitId === 'unit-5') locationCode = 'CBE';
  else if (unitId === 'unit-6') locationCode = 'TRP';
  else if (unitId === 'unit-7') locationCode = 'CHN';
  
  // Customer portal is the only creator of catering orders currently
  const prefix = `SNC-${locationCode}`;
  
  // Find highest serial for this prefix
  let maxSerial = 100;
  const existingOrders = db.catering_orders || [];
  for (const ord of existingOrders) {
    if (ord.enquiryNumber && ord.enquiryNumber.startsWith(prefix + '-')) {
      const parts = ord.enquiryNumber.split('-');
      if (parts.length === 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxSerial) {
          maxSerial = num;
        }
      }
    }
  }
  
  const nextSerial = maxSerial + 1;
  const enquiryNumber = `${prefix}-${String(nextSerial).padStart(5, '0')}`;
  
  const initialPaymentHistory = orderData.advancePaid && parseFloat(orderData.advancePaid) > 0 ? [{
    date: new Date().toISOString().split('T')[0],
    description: 'Initial Advance Booking Payment',
    amount: parseFloat(orderData.advancePaid),
    method: orderData.paymentMethod || 'cash',
    refNo: orderData.transactionNumber || '',
    recordedBy: orderData.createdById || 'Staff'
  }] : [];

  const initialAmendmentLog = [{
    timestamp: new Date().toISOString(),
    user: orderData.createdById || 'Staff',
    action: 'ENQUIRY_CREATED',
    details: `Enquiry ${enquiryNumber} created for ${orderData.eventType || 'Event'} (${orderData.guestCount || 0} pax)`
  }];

  const newOrder = {
    id: "cat-" + Date.now(),
    enquiryNumber,
    bookingRefNumber: null,
    enquirySupersededBy: null,
    paymentHistory: initialPaymentHistory,
    amendmentLog: initialAmendmentLog,
    status: orderData.status || "enquiry",
    advancePaid: orderData.advancePaid || 0,
    pendingBalance: orderData.totalQuote || 0,
    vehicleType: "None",
    vehicleId: null,
    driverId: null,
    deliveryAddress: orderData.deliveryAddress || "",
    confirmedDeliveryAddress: "",
    addressConfirmedByCustomer: false,
    reminderSent: false,
    driverLatitude: 10.9601,
    driverLongitude: 78.0766,
    trackingActive: false,
    paymentStatus: "Pending",
    customerFeedbackText: "",
    customerFeedbackRating: 0,
    isReferral: orderData.isReferral || false,
    referralName: orderData.referralName || null,
    referralMobile: orderData.referralMobile || null,
    referralRelationship: orderData.referralRelationship || null,
    referredByCustomerId: orderData.referredByCustomerId || null,
    referredByCustomerName: orderData.referredByCustomerName || null,
    createdAt: new Date().toISOString(),
    ...orderData
  };
  db.catering_orders.push(newOrder);
  saveDB(db);
  logAudit(orderData.createdById || "SYSTEM", orderData.unitId, "NEW_CATERING", `Catering booking created: ${enquiryNumber} status: ${newOrder.status}`);
  return newOrder;
};

export const generateOrderId = (orderIdOrEnq, userId = 'Staff') => {
  const db = getDB();
  const order = (db.catering_orders || []).find(o => o.id === orderIdOrEnq || o.enquiryNumber === orderIdOrEnq || o.bookingRefNumber === orderIdOrEnq || o.orderNumber === orderIdOrEnq);
  if (!order) return null;
  if (order.bookingRefNumber || order.orderNumber) return order.orderNumber || order.bookingRefNumber;

  const unitId = order.unitId || 'unit-2';
  let locationCode = 'GEN';
  if (unitId === 'unit-1') locationCode = 'KRR';
  else if (unitId === 'unit-2') locationCode = 'NK';
  else if (unitId === 'unit-3') locationCode = 'SLM';
  else if (unitId === 'unit-4') locationCode = 'ERD';
  else if (unitId === 'unit-5') locationCode = 'CBE';
  else if (unitId === 'unit-6') locationCode = 'TRP';
  else if (unitId === 'unit-7') locationCode = 'CHN';

  const prefix = `ORD-${locationCode}`;
  let maxSerial = 100;
  for (const ord of (db.catering_orders || [])) {
    const numRef = ord.orderNumber || ord.bookingRefNumber || '';
    if (numRef && (numRef.startsWith(prefix + '-') || numRef.startsWith(`BRN-${locationCode}-`))) {
      const parts = numRef.split('-');
      if (parts.length === 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxSerial) {
          maxSerial = num;
        }
      }
    }
  }

  const nextSerial = maxSerial + 1;
  const orderId = `${prefix}-${String(nextSerial).padStart(5, '0')}`;
  
  order.orderNumber = orderId;
  order.bookingRefNumber = orderId;
  order.enquirySupersededBy = orderId;
  order.status = 'confirmed';
  if (!order.amendmentLog) order.amendmentLog = [];
  order.amendmentLog.push({
    timestamp: new Date().toISOString(),
    user: userId,
    action: 'CONVERT_TO_ORDER',
    details: `Enquiry ${order.enquiryNumber || order.id} successfully converted to Confirmed Order ID: ${orderId}`
  });

  saveDB(db);
  logAudit(userId, order.unitId, "CONVERT_TO_ORDER", `Enquiry ${order.enquiryNumber} converted to Order ID ${orderId}`);
  return orderId;
};

export const generateBRN = generateOrderId;

export const recordOrderPayment = (orderIdentifier, paymentData, userId = 'Staff') => {
  const db = getDB();
  const order = (db.catering_orders || []).find(o => o.id === orderIdentifier || o.bookingRefNumber === orderIdentifier || o.enquiryNumber === orderIdentifier);
  if (!order) return null;

  if (!order.paymentHistory) order.paymentHistory = [];
  const paymentEntry = {
    date: paymentData.date || new Date().toISOString().split('T')[0],
    description: paymentData.description || 'Installment Payment',
    amount: parseFloat(paymentData.amount || 0),
    method: paymentData.method || 'cash',
    refNo: paymentData.refNo || '',
    recordedBy: userId
  };

  order.paymentHistory.push(paymentEntry);
  order.advancePaid = (parseFloat(order.advancePaid) || 0) + paymentEntry.amount;
  order.pendingBalance = Math.max(0, (parseFloat(order.totalQuote) || 0) - order.advancePaid);

  if (!order.amendmentLog) order.amendmentLog = [];
  order.amendmentLog.push({
    timestamp: new Date().toISOString(),
    user: userId,
    action: 'PAYMENT_RECORDED',
    details: `Recorded ₹${paymentEntry.amount} via ${paymentEntry.method.toUpperCase()} (Ref: ${paymentEntry.refNo || 'N/A'}). Balance: ₹${order.pendingBalance}`
  });

  saveDB(db);
  logAudit(userId, order.unitId, "PAYMENT_RECORDED", `Payment of ₹${paymentEntry.amount} recorded for ${order.bookingRefNumber || order.enquiryNumber}`);
  return order;
};

export const addOrderAmendment = (orderIdentifier, amendmentData, userId = 'Staff') => {
  const db = getDB();
  const order = (db.catering_orders || []).find(o => o.id === orderIdentifier || o.bookingRefNumber === orderIdentifier || o.enquiryNumber === orderIdentifier);
  if (!order) return null;

  if (!order.amendmentLog) order.amendmentLog = [];
  order.amendmentLog.push({
    timestamp: new Date().toISOString(),
    user: userId,
    action: amendmentData.action || 'AMENDMENT',
    details: amendmentData.details || amendmentData.note || 'Order details amended'
  });

  saveDB(db);
  return order;
};

export const updateCateringOrder = (orderId, updates, userId) => {
  const db = getDB();
  const orderIndex = db.catering_orders.findIndex(ord => ord.id === orderId);
  if (orderIndex !== -1) {
    const old = db.catering_orders[orderIndex];
    const updated = { ...old, ...updates };
    
    updated.pendingBalance = Math.max(0, updated.totalQuote - updated.advancePaid);
    db.catering_orders[orderIndex] = updated;
    saveDB(db);
    logAudit(userId, updated.unitId, "UPDATE_CATERING", `Updated catering order ${updated.enquiryNumber}. Status: ${updated.status}`);
    return updated;
  }
  return null;
};
// --- CUSTOMERS API ---
export const addCustomer = (customerData) => {
  const db = getDB();
  const exists = db.customers.find(c => c.mobile === customerData.mobile);
  if (exists) {
    if (customerData.latitude) {
      exists.latitude = customerData.latitude;
      exists.longitude = customerData.longitude;
      saveDB(db);
    }
    return exists;
  }
  const newCustomer = {
    id: "cust-" + Date.now(),
    alternateMobile: "",
    address: "",
    notes: "",
    latitude: customerData.latitude || null,
    longitude: customerData.longitude || null,
    createdAt: new Date().toISOString().split('T')[0],
    lastLoginDate: new Date().toISOString().split('T')[0],
    status: "active",
    ...customerData
  };
  db.customers.push(newCustomer);
  saveDB(db);
  return newCustomer;
};
export const updateCustomer = (id, data) => {
  const db = getDB();
  const index = db.customers.findIndex(c => c.id === id);
  if (index !== -1) {
    db.customers[index] = { ...db.customers[index], ...data };
    saveDB(db);
    return db.customers[index];
  }
  return null;
};
export const deboardCustomer = (id) => {
  const db = getDB();
  const index = db.customers.findIndex(c => c.id === id);
  if (index !== -1) {
    db.customers[index].status = "deboarded";
    saveDB(db);
    return true;
  }
  return false;
};
// --- EMPLOYEE HR API ---
export const updateEmployeeWorkingUnit = (employeeId, workingUnitId, reason, managerId) => {
  const db = getDB();
  const empIndex = db.employees.findIndex(e => e.id === employeeId);
  if (empIndex !== -1) {
    const emp = db.employees[empIndex];
    const oldWorkingUnit = emp.workingUnitId;
    
    emp.workingUnitId = workingUnitId;
    if (!emp.transferHistory) emp.transferHistory = [];
    emp.transferHistory.push({
      date: new Date().toISOString().split('T')[0],
      fromUnit: oldWorkingUnit,
      toUnit: workingUnitId,
      reason: reason
    });
    saveDB(db);
    logAudit(managerId, workingUnitId, "EMPLOYEE_TRANSFER", `Transferred ${emp.name} working unit from ${oldWorkingUnit} to ${workingUnitId}. Reason: ${reason}`);
    return true;
  }
  return false;
};
export const generateNextEmployeeId = (role, employmentType, db) => {
  const isContract = employmentType === 'contract' || employmentType === 'contractual';
  const isMgmt = role === 'Top Management';
  const isStaff = role === 'Unit Manager' || role === 'Cashier' || role === 'Senior Manager';
  
  let baseNumber = 0;
  if (isContract) {
    baseNumber = 50000;
  } else if (isMgmt) {
    baseNumber = 1001;
  } else if (isStaff) {
    baseNumber = 1101;
  } else {
    baseNumber = 4001;
  }
  
  let maxId = baseNumber - 1;
  db.employees.forEach(emp => {
    const numId = parseInt(emp.id);
    if (!isNaN(numId)) {
      if (isContract && numId >= 50000) {
        if (numId > maxId) maxId = numId;
      } else if (isMgmt && numId >= 1001 && numId < 1101) {
        if (numId > maxId) maxId = numId;
      } else if (isStaff && numId >= 1101 && numId < 4001) {
        if (numId > maxId) maxId = numId;
      } else if (!isContract && !isMgmt && !isStaff && numId >= 4001 && numId < 50000) {
        if (numId > maxId) maxId = numId;
      }
    }
  });
  
  return String(maxId + 1);
};
export const addEmployee = (empData, managerId) => {
  const db = getDB();
  const id = generateNextEmployeeId(empData.role, empData.employmentType, db);
  
  const newEmp = {
    id,
    transferHistory: [],
    attendancePunches: [],
    currentLatitude: 10.9601,
    currentLongitude: 78.0766,
    password: "1234",
    status: "active",
    requires2FA: true,
    notifications: [
      {
        id: "notif-" + Date.now(),
        type: "welcome",
        subject: "Welcome to Sri Nathi Family!",
        sender: "HR Admin",
        timestamp: new Date().toISOString(),
        body: `Dear ${empData.name},\n\nWelcome to Sri Nathi! We are thrilled to have you join us as a ${empData.role} in the ${empData.department || 'Operations'} department.\n\nYour Employee ID is: ${id}\nDefault password is: 1234\n\nPlease log in to your portal and update your password immediately.\n\nBest regards,\nTop Management`
      }
    ],
    ...empData
  };
  db.employees.push(newEmp);
  saveDB(db);
  logAudit(managerId, empData.assignedUnitId || "unit-1", "ADD_EMPLOYEE", `Approved and added new employee ${newEmp.name} (ID: ${id}, Role: ${newEmp.role})`);
  return newEmp;
};
export const createHRRequest = (reqData, requesterId) => {
  const db = getDB();
  const newReq = {
    id: "req-" + Date.now(),
    status: "pending",
    requestedBy: requesterId,
    requestedAt: new Date().toISOString(),
    ...reqData
  };
  if (!db.hr_requests) db.hr_requests = [];
  db.hr_requests.push(newReq);
  saveDB(db);
  logAudit(requesterId, getUnitId(), "HR_REQUEST_CREATE", `Created HR request for ${reqData.type === 'new_hire' ? reqData.employeeData.name : ('termination of ' + reqData.employeeId)}`);
  return newReq;
};
export const approveHRRequest = (reqId, approverId) => {
  const db = getDB();
  const reqIndex = db.hr_requests.findIndex(r => r.id === reqId);
  if (reqIndex === -1) return false;
  
  const req = db.hr_requests[reqIndex];
  req.status = "approved";
  req.reviewedBy = approverId;
  req.reviewedAt = new Date().toISOString();
  
  if (req.type === "new_hire") {
    addEmployee(req.employeeData, approverId);
  } else if (req.type === "termination") {
    const empIndex = db.employees.findIndex(e => e.id === req.employeeId);
    if (empIndex !== -1) {
      db.employees[empIndex].status = "terminated";
      logAudit(approverId, db.employees[empIndex].assignedUnitId || getUnitId(), "EMPLOYEE_TERMINATE", `Approved termination for ${db.employees[empIndex].name} (ID: ${req.employeeId}). Reason: ${req.reason}`);
      
      // Generate Automated F&F Settlement
      setTimeout(() => {
        alert(`Full & Final Settlement automatically generated for ${db.employees[empIndex].name}.\n\nPending wages, encashments, and deductions calculated successfully. Financial statement forwarded to HR & employee email.`);
      }, 500);
    }
  }
  
  saveDB(db);
  return true;
};
export const rejectHRRequest = (reqId, approverId, reason) => {
  const db = getDB();
  const reqIndex = db.hr_requests.findIndex(r => r.id === reqId);
  if (reqIndex === -1) return false;
  
  const req = db.hr_requests[reqIndex];
  req.status = "rejected";
  req.reviewedBy = approverId;
  req.reviewedAt = new Date().toISOString();
  req.rejectionReason = reason;
  
  saveDB(db);
  logAudit(approverId, getUnitId(), "HR_REQUEST_REJECT", `Rejected HR request ${reqId}. Reason: ${reason}`);
  return true;
};
// --- COMPLIANCE LICENSES API ---
export const createLicense = (licenseData, userId) => {
  const db = getDB();
  const issueDateObj = new Date(licenseData.issueDate);
  const renewalDateObj = new Date(issueDateObj.setFullYear(issueDateObj.getFullYear() + 1));
  const renewalDate = renewalDateObj.toISOString().split('T')[0];
  const newLicense = {
    id: "lic-" + Date.now(),
    renewalDate,
    warningThresholdDays: 30,
    ...licenseData
  };
  db.compliance_licenses.push(newLicense);
  saveDB(db);
  logAudit(userId, getUnitId(), "NEW_LICENSE", `Logged license: ${newLicense.name} (${newLicense.licenseNumber})`);
  return newLicense;
};
export const deleteLicense = (licenseId, userId) => {
  const db = getDB();
  const index = db.compliance_licenses.findIndex(lic => lic.id === licenseId);
  if (index !== -1) {
    const licName = db.compliance_licenses[index].name;
    db.compliance_licenses.splice(index, 1);
    saveDB(db);
    logAudit(userId, getUnitId(), "DELETE_LICENSE", `Deleted license document: ${licName}`);
    return true;
  }
  return false;
};
// --- EXPENSES & DAILY WAGE API ---
export const createExpense = (expenseData) => {
  const db = getDB();
  const newExpense = {
    id: "exp-" + Date.now(),
    timestamp: new Date().toISOString(),
    ...expenseData
  };
  db.expenses.push(newExpense);
  saveDB(db);
  logAudit(expenseData.cashierId, expenseData.unitId, "NEW_EXPENSE", `Recorded ${expenseData.category} expense: ₹${expenseData.amount}`);
  return newExpense;
};
// --- UTILITY BBPS API ---
export const payUtilityBill = (billId, cashierId, unitId) => {
  const db = getDB();
  const billIndex = db.utility_bills.findIndex(b => b.id === billId);
  if (billIndex !== -1) {
    const bill = db.utility_bills[billIndex];
    bill.status = "Paid";
    
    createExpense({
      unitId,
      cashierId,
      category: "Utility Bill",
      amount: bill.amountDue,
      description: `Auto-BBPS paid for biller: ${bill.billerName} (${bill.consumerNumber})`,
      paymentMode: "Cash"
    });
    saveDB(db);
    logAudit(cashierId, unitId, "PAY_UTILITY_BILL", `Paid BBPS bill: ${bill.billerName} amount ₹${bill.amountDue}`);
    return true;
  }
  return false;
};
// --- MENU MASTER OPERATIONS ---
export const saveMenuItem = (itemData, userId) => {
  const db = getDB();
  if (itemData.id) {
    const index = db.menu.findIndex(m => m.id === itemData.id);
    if (index !== -1) {
      db.menu[index] = { ...db.menu[index], ...itemData };
      saveDB(db);
      logAudit(userId, getUnitId(), "EDIT_MENU_ITEM", `Edited menu pricing: ${itemData.name} set to ₹${itemData.price}`);
      return db.menu[index];
    }
  } else {
    const newItem = {
      id: "menu-" + Date.now(),
      gstRate: 5,
      active: true,
      ...itemData
    };
    db.menu.push(newItem);
    saveDB(db);
    logAudit(userId, getUnitId(), "ADD_MENU_ITEM", `Created new menu item: ${newItem.name} at ₹${newItem.price}`);
    return newItem;
  }
  return null;
};
export const deleteMenuItem = (itemId, userId) => {
  const db = getDB();
  const index = db.menu.findIndex(m => m.id === itemId);
  if (index !== -1) {
    const name = db.menu[index].name;
    db.menu.splice(index, 1);
    saveDB(db);
    logAudit(userId, getUnitId(), "DELETE_MENU_ITEM", `Deleted menu item: ${name}`);
    return true;
  }
  return false;
};
// --- SMART SCALE GOODS ISSUE API ---
export const issueInventoryGoods = (itemCode, qtyIssued, empId, unitId, purpose = "Daily Kitchen Prep") => {
  const db = getDB();
  const item = db.inventory.find(inv => inv.itemCode === parseInt(itemCode) && inv.unitId === unitId);
  const employee = db.employees ? db.employees.find(e => e.id === empId || e.name === empId) : null;
  if (item) {
    const prevStock = item.stockQty;
    item.stockQty = Math.max(0, parseFloat((item.stockQty - qtyIssued).toFixed(2)));
    saveDB(db);
    const empName = employee ? employee.name : (empId || "Kitchen Staff");
    logAudit(empId || "system", unitId, "GOODS_ISSUE", `Issued ${qtyIssued} ${item.unitOfMeasure} of ${item.name} to ${empName} (${purpose}). Stock: ${prevStock} -> ${item.stockQty}`);
    return { success: true, item, prevStock };
  }
  return { success: false };
};
// --- PURCHASE ENTRY API ---
export const recordInventoryPurchase = (purchaseData, cashierId, unitId) => {
  const db = getDB();
  const item = db.inventory.find(inv => inv.itemCode === parseInt(purchaseData.itemCode) && inv.unitId === unitId);
  
  if (item) {
    item.stockQty = parseFloat((item.stockQty + purchaseData.qtyPurchased).toFixed(2));
    item.safetyReserve = purchaseData.safetyReserve || item.safetyReserve;
    item.unitPrice = purchaseData.unitPrice || item.unitPrice;
    if (purchaseData.category) item.category = purchaseData.category;
    if (purchaseData.unit) item.unitOfMeasure = purchaseData.unit;
  } else {
    const id = "inv-" + Date.now();
    db.inventory.push({
      id,
      itemCode: parseInt(purchaseData.itemCode),
      name: purchaseData.name,
      category: purchaseData.category || "Groceries & Grains",
      unitOfMeasure: purchaseData.unit || "kg",
      stockQty: purchaseData.qtyPurchased,
      safetyReserve: purchaseData.safetyReserve || 10,
      unitId,
      unitPrice: purchaseData.unitPrice
    });
  }
  createExpense({
    unitId,
    cashierId,
    category: "Purchase Log",
    amount: purchaseData.qtyPurchased * purchaseData.unitPrice,
    description: `Purchased ${purchaseData.qtyPurchased} ${purchaseData.unit || 'kg'} of ${purchaseData.name} @ ₹${purchaseData.unitPrice}/unit`,
    paymentMode: "Cash"
  });
  saveDB(db);
  logAudit(cashierId, unitId, "PURCHASE_REGISTER", `Registered purchase of ${purchaseData.qtyPurchased} ${purchaseData.unit || 'kg'} ${purchaseData.name}`);
  return true;
};
// --- PHYSICAL STOCK AUDIT & ADJUSTMENT API ---
export const adjustInventoryStock = (itemCode, newQty, reason, userId, unitId) => {
  const db = getDB();
  const item = db.inventory.find(inv => inv.itemCode === parseInt(itemCode) && inv.unitId === unitId);
  if (item) {
    const prevStock = item.stockQty;
    const diff = parseFloat((newQty - prevStock).toFixed(2));
    item.stockQty = parseFloat(Number(newQty).toFixed(2));
    saveDB(db);
    logAudit(userId || "manager", unitId, "STOCK_ADJUSTMENT", `Physical Audit: ${item.name} adjusted from ${prevStock} to ${item.stockQty} ${item.unitOfMeasure}. Variance: ${diff > 0 ? '+' : ''}${diff}. Reason: ${reason || 'Physical Count'}`);
    return { success: true, item, prevStock, diff };
  }
  return { success: false };
};
// --- TELEMETRY DRIVER LOCATION SIMULATION ---
export const simulateTelemetry = () => {
  const db = getDB();
  let updated = false;
  if (db.employees) {
    db.employees.forEach(emp => {
      if (emp.role === "Employee" || emp.id === "sn-driver") {
        emp.currentLatitude += (Math.random() - 0.5) * 0.0015;
        emp.currentLongitude += (Math.random() - 0.5) * 0.0015;
        updated = true;
      }
    });
  }
  if (db.catering_orders && db.employees && db.customers) {
    db.catering_orders.forEach(ord => {
      if (ord.status === "dispatched" && ord.driverId) {
        const driver = db.employees.find(e => e.id === ord.driverId);
        const customer = db.customers.find(c => c.id === ord.customerId);
        if (driver && customer) {
          const dLat = customer.latitude - driver.currentLatitude;
          const dLon = customer.longitude - driver.currentLongitude;
          
          if (Math.abs(dLat) > 0.0001 || Math.abs(dLon) > 0.0001) {
            driver.currentLatitude += dLat * 0.15;
            driver.currentLongitude += dLon * 0.15;
            ord.driverLatitude = driver.currentLatitude;
            ord.driverLongitude = driver.currentLongitude;
            ord.trackingActive = true;
            updated = true;
          } else {
            ord.status = "pickup pending";
            ord.trackingActive = false;
            updated = true;
          }
        }
      }
    });
  }
  if (updated) {
    saveDB(db);
  }
};
// --- AUTO GENERATED PICKLIST LOGIC ---
export const generatePicklists = (order) => {
  const guestCount = order.guestCount || 0;
  const rawMaterials = [
    { name: "Basmati Rice", category: "Groceries", qty: Math.ceil(guestCount * 0.15), unit: "kg" },
    { name: "Sunflower Oil", category: "Oil", qty: Math.ceil(guestCount * 0.05), unit: "Litres" },
    { name: "Onions & Veg", category: "Vegetables", qty: Math.ceil(guestCount * 0.2), unit: "kg" },
    { name: "Spices Mix", category: "Spices", qty: parseFloat((guestCount * 0.02).toFixed(2)), unit: "kg" },
    { name: "Milk / Dairy", category: "Dairy", qty: Math.ceil(guestCount * 0.08), unit: "Litres" },
    { name: "Packaging Box/Materials", category: "Packing Materials", qty: guestCount, unit: "Pcs" }
  ];
  let vessels = [];
  if (!order.customerHasOwnVessels) {
    vessels = [
      { name: "Large Serving Vessels", category: "Vessels", qtyRequired: Math.ceil(guestCount / 100) + 1, qtyAvailable: 8, qtyReserved: 2 },
      { name: "Sambar Carriers", category: "Vessels", qtyRequired: Math.ceil(guestCount / 150) + 1, qtyAvailable: 6, qtyReserved: 1 },
      { name: "Ladles & Serving Spoons", category: "Spoons", qtyRequired: Math.ceil(guestCount / 50) + 2, qtyAvailable: 25, qtyReserved: 4 },
      { name: "Buckets (Stainless Steel)", category: "Buckets", qtyRequired: Math.ceil(guestCount / 100) + 2, qtyAvailable: 15, qtyReserved: 3 },
      { name: "Buffet Plates / Spoon Holders", category: "Event Utensils", qtyRequired: Math.ceil(guestCount / 50) + 2, qtyAvailable: 10, qtyReserved: 2 }
    ];
  }
  return { rawMaterials, vessels };
};
// --- AUTHENTICATION PROVIDER SERVICE (Clerk / Firebase / Auth0 / Local Fallback) ---
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};
export class AuthService {
  constructor() {
    this.config = JSON.parse(SecureStorage.getItem('sri_nathi_auth_config') || '{"provider":"local"}');
    this.isInitialized = false;
  }
  async initialize() {
    if (this.isInitialized) return;
    try {
      if (this.config.provider === 'firebase' && this.config.firebaseApiKey) {
        await loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
        await loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js");
        if (window.firebase && !firebase.apps.length) {
          firebase.initializeApp({
            apiKey: this.config.firebaseApiKey,
            authDomain: this.config.firebaseAuthDomain,
            projectId: this.config.firebaseProjectId
          });
        }
      } else if (this.config.provider === 'clerk' && this.config.clerkPublishableKey) {
        await loadScript("https://cdn.jsdelivr.net/npm/@clerk/clerk-js@4/dist/clerk.browser.js");
        if (window.Clerk) {
          await window.Clerk.load({
            publishableKey: this.config.clerkPublishableKey
          });
        }
      } else if (this.config.provider === 'auth0' && this.config.auth0Domain) {
        await loadScript("https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js");
      }
      this.isInitialized = true;
    } catch (e) {
      console.error("Failed to initialize selected identity provider SDKs:", e);
    }
  }
  getProvider() {
    return this.config.provider || 'local';
  }
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    SecureStorage.setItem('sri_nathi_auth_config', JSON.stringify(this.config));
    this.isInitialized = false;
  }
  async login(usernameOrEmail, password, targetPortal) {
    await this.initialize();
    
    const provider = this.getProvider();
    
    if (provider === 'firebase' && this.config.firebaseApiKey) {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(usernameOrEmail, password);
      return { email: userCredential.user.email, provider: 'firebase' };
    } 
    
    if (provider === 'clerk' && this.config.clerkPublishableKey) {
      const signInAttempt = await window.Clerk.client.signIn.create({
        identifier: usernameOrEmail,
        password: password
      });
      if (signInAttempt.status === "complete") {
        await window.Clerk.setActive({ session: signInAttempt.createdSessionId });
        return { email: usernameOrEmail, provider: 'clerk' };
      }
      throw new Error("Clerk authentication is incomplete or requires extra verification steps.");
    }
    if (provider === 'auth0' && this.config.auth0Domain && this.config.auth0ClientId) {
      const res = await fetch(`https://${this.config.auth0Domain}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
          username: usernameOrEmail,
          password: password,
          client_id: this.config.auth0ClientId,
          realm: 'Username-Password-Authentication',
          scope: 'openid profile email'
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error_description || "Auth0 authentication failed.");
      }
      const tokenData = await res.json();
      return { email: usernameOrEmail, token: tokenData.access_token, provider: 'auth0' };
    }
    // Default Fallback: Local Secure PBKDF2 Server check (Local authentication mode)
    const res = await SecureAPIConnector.login(usernameOrEmail, password, targetPortal);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const detailObj = typeof errData.detail === 'object' && errData.detail ? errData.detail : errData;
      const msgText = detailObj.message || detailObj.detail || (typeof errData.detail === 'string' ? errData.detail : "Invalid credentials.");
      const err = new Error(msgText);
      err.errorCode = detailObj.error_code || detailObj.errorCode;
      err.lockoutSeconds = detailObj.lockout_remaining_seconds || detailObj.lockoutRemainingSeconds;
      err.incidentId = detailObj.incident_id || detailObj.incidentId;
      throw err;
    }
    const data = await res.json();
    if (data.token) {
      SecureStorage.setItem('sri_nathi_jwt_token', data.token);
    }
    if (data.sessionToken) {
      SecureStorage.setItem('sri_nathi_session_token', data.sessionToken);
    }
    return { email: data.employee.email || data.employee.id, employee: data.employee, unitId: data.unitId, provider: 'local', targetPortal: data.targetPortal || targetPortal };
  }
  async logout() {
    const keysToPurge = [
      'sri_nathi_session_user',
      'sri_nathi_jwt_token',
      'sri_nathi_session_token',
      'sri_nathi_active_unit',
      'sri_nathi_sso_emp_id',
      'sri_nathi_session_locked',
      'sri_nathi_last_activity',
      'sri_nathi_session_customer'
    ];
    keysToPurge.forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
      try { sessionStorage.removeItem(k); } catch(e) {}
      try { SecureStorage.removeItem(k); } catch(e) {}
    });
    try { sessionStorage.clear(); } catch(e) {}

    try {
      document.cookie = "sri_nathi_jwt_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
    } catch(e) {}

    const provider = this.getProvider();
    try {
      if (provider === 'firebase' && this.config.firebaseApiKey && window.firebase && firebase.auth) {
        await firebase.auth().signOut();
      } else if (provider === 'clerk' && this.config.clerkPublishableKey && window.Clerk) {
        await window.Clerk.signOut();
      }
    } catch (e) {
      console.warn("Logout provider error:", e);
    }
  }
}
export const authService = new AuthService();
window.openAuthSettingsModal = () => {
  const currentConfig = JSON.parse(SecureStorage.getItem('sri_nathi_auth_config') || '{"provider":"local"}');
  const provider = currentConfig.provider || 'local';
  const modal = document.createElement('div');
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 480px; animation: card-pop 0.3s ease; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); color: var(--text-main); font-family: var(--font-body);">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 16px; color: var(--primary); display: flex; align-items: center; gap: 8px; font-weight: 700;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Identity &amp; Auth Configuration
        </h3>
        <button class="btn-close-modal" style="background:none; border:none; font-size:18px; cursor:pointer; color: var(--text-muted); outline:none;">&times;</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 15px; font-size: 13px;">
        <p style="color: var(--text-muted); line-height: 1.5; margin: 0;">
          Outsource your credentials check to a trusted identity provider or use the local secure server:
        </p>
        
        <div class="form-group">
          <label class="form-label" style="font-weight: 600; margin-bottom: 6px; display: block; color: var(--text-muted);">Active Identity Provider</label>
          <select id="auth-provider-select" class="form-control" style="width: 100%; height: 38px; border-radius: 6px; padding: 0 10px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); outline:none;">
            <option value="local" ${provider === 'local' ? 'selected' : ''}>️ Local Secure Auth (PBKDF2 Hashed, Rate Limits &amp; Lockout)</option>
            <option value="firebase" ${provider === 'firebase' ? 'selected' : ''}> Firebase Authentication (Email/Password &amp; SSO)</option>
            <option value="clerk" ${provider === 'clerk' ? 'selected' : ''}> Clerk Auth Widget (SSO, MFA &amp; Passwordless)</option>
            <option value="auth0" ${provider === 'auth0' ? 'selected' : ''}>Auth0 SPA authentication (Enterprise Single Sign-On)</option>
            <option value="microsoft" ${provider === 'microsoft' ? 'selected' : ''}>Microsoft Azure AD SSO (Default Corporate Single Sign-On)</option>
          </select>
        </div>
        <!-- Firebase Config fields -->
        <div id="firebase-fields" style="display: ${provider === 'firebase' ? 'block' : 'none'}; animation: card-pop 0.2s ease;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-weight: 600; margin-bottom: 4px; display: block;">Firebase API Key</label>
            <input type="password" id="auth-firebase-apikey" class="form-control" value="${currentConfig.firebaseApiKey || ''}" placeholder="AIzaSy..." style="width: 100%; height: 36px; border-radius: 6px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0 10px;">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-weight: 600; margin-bottom: 4px; display: block;">Auth Domain</label>
            <input type="text" id="auth-firebase-domain" class="form-control" value="${currentConfig.firebaseAuthDomain || ''}" placeholder="your-project.firebaseapp.com" style="width: 100%; height: 36px; border-radius: 6px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0 10px;">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 600; margin-bottom: 4px; display: block;">Project ID</label>
            <input type="text" id="auth-firebase-projectid" class="form-control" value="${currentConfig.firebaseProjectId || ''}" placeholder="your-project" style="width: 100%; height: 36px; border-radius: 6px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0 10px;">
          </div>
        </div>
        <!-- Clerk Config fields -->
        <div id="clerk-fields" style="display: ${provider === 'clerk' ? 'block' : 'none'}; animation: card-pop 0.2s ease;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 600; margin-bottom: 4px; display: block;">Clerk Publishable Key</label>
            <input type="password" id="auth-clerk-pubkey" class="form-control" value="${currentConfig.clerkPublishableKey || ''}" placeholder="pk_test_..." style="width: 100%; height: 36px; border-radius: 6px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0 10px;">
          </div>
        </div>
        <!-- Auth0 Config fields -->
        <div id="auth0-fields" style="display: ${provider === 'auth0' ? 'block' : 'none'}; animation: card-pop 0.2s ease;">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-weight: 600; margin-bottom: 4px; display: block;">Auth0 Domain</label>
            <input type="text" id="auth-auth0-domain" class="form-control" value="${currentConfig.auth0Domain || ''}" placeholder="your-tenant.us.auth0.com" style="width: 100%; height: 36px; border-radius: 6px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0 10px;">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 600; margin-bottom: 4px; display: block;">Auth0 Client ID</label>
            <input type="text" id="auth-auth0-clientid" class="form-control" value="${currentConfig.auth0ClientId || ''}" placeholder="Enter Client ID" style="width: 100%; height: 36px; border-radius: 6px; background: var(--bg-main); border: 1px solid var(--border); color: var(--text-main); padding: 0 10px;">
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 16px;">
        <button class="btn btn-secondary btn-close-modal" style="height: 36px; border-radius: 6px; padding: 0 15px; font-weight: 600; border: 1px solid var(--border); background: transparent; color: var(--text-main); cursor:pointer;">Cancel</button>
        <button class="btn btn-primary" id="btn-save-auth-settings" style="height: 36px; border-radius: 6px; padding: 0 15px; font-weight: 600; background: var(--primary); color: white; border: none; cursor:pointer;">Save Configuration</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const closeModal = () => modal.remove();
  modal.querySelectorAll('.btn-close-modal').forEach(btn => btn.addEventListener('click', closeModal));
  const select = modal.querySelector('#auth-provider-select');
  const firebaseFields = modal.querySelector('#firebase-fields');
  const clerkFields = modal.querySelector('#clerk-fields');
  const auth0Fields = modal.querySelector('#auth0-fields');
  select.addEventListener('change', (e) => {
    firebaseFields.style.display = e.target.value === 'firebase' ? 'block' : 'none';
    clerkFields.style.display = e.target.value === 'clerk' ? 'block' : 'none';
    auth0Fields.style.display = e.target.value === 'auth0' ? 'block' : 'none';
  });
  modal.querySelector('#btn-save-auth-settings').addEventListener('click', () => {
    const nextProvider = select.value;
    const updatePayload = { provider: nextProvider };
    if (nextProvider === 'firebase') {
      updatePayload.firebaseApiKey = modal.querySelector('#auth-firebase-apikey').value.trim();
      updatePayload.firebaseAuthDomain = modal.querySelector('#auth-firebase-domain').value.trim();
      updatePayload.firebaseProjectId = modal.querySelector('#auth-firebase-projectid').value.trim();
    } else if (nextProvider === 'clerk') {
      updatePayload.clerkPublishableKey = modal.querySelector('#auth-clerk-pubkey').value.trim();
    } else if (nextProvider === 'auth0') {
      updatePayload.auth0Domain = modal.querySelector('#auth-auth0-domain').value.trim();
      updatePayload.auth0ClientId = modal.querySelector('#auth-auth0-clientid').value.trim();
    }
    authService.updateConfig(updatePayload);
    closeModal();
    if (typeof showToastNotification === 'function') {
      showToastNotification(
        "Identity Provider Saved",
        `Configured authentication provider: ${nextProvider.toUpperCase()}`
      );
    } else {
      alert(`Identity Provider Settings saved for: ${nextProvider.toUpperCase()}`);
    }
  });
};
// Process SSO Auto-Login from URL query parameter on boot
(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const ssoEmail = urlParams.get('sso_email');
  if (ssoEmail) {
    try {
      // Find the employee in the loaded database
      const db = getDB();
      if (db && db.employees) {
        const foundEmp = db.employees.find(emp => emp.email === ssoEmail || emp.id === ssoEmail);
        if (foundEmp) {
          SecureStorage.setItem('sri_nathi_session_user', JSON.stringify(foundEmp));
          SecureStorage.setItem('sri_nathi_active_unit', foundEmp.assignedUnitId);
          
          // Clear query params to keep clean URL
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: newUrl }, '', newUrl);
          
          // Force reload to apply session
          window.location.reload();
        } else {
          console.warn(`SSO authenticated email "${ssoEmail}" not found in Sri Nathi database employees list.`);
          alert(`Microsoft SSO login succeeded, but no matching employee profile exists in Sri Nathi for "${ssoEmail}".`);
          // Clear query params
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: newUrl }, '', newUrl);
        }
      }
    } catch (err) {
      console.error("Failed to process SSO login callback:", err);
    }
  }
})();
// Enterprise Zero-Trust Security Suite (Welcome Toast & Inactivity Curtain)
export const SecuritySuite = {
  showWelcomeToast: (user, portalName) => {
    const existing = document.getElementById('zt-welcome-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'zt-welcome-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 20px -5px rgba(16, 185, 129, 0.2);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 380px;
      font-family: 'Inter', sans-serif;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    const did = SecureStorage.getItem('sri_nathi_device_id') || 'terminal-1';
    const shortDid = did.length > 16 ? did.substring(0, 16) + '...' : did;
    toast.innerHTML = `
      <div style="width:40px; height:40px; border-radius:12px; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:13px; font-weight:700; color:#f8fafc; font-family:'Outfit', sans-serif;">Zero-Trust Session Active</span>
          <span style="width:6px; height:6px; border-radius:50%; background:#10b981; display:inline-block;"></span>
        </div>
        <div style="font-size:11px; color:#94a3b8; margin-top:3px; line-height:1.4;">
          Authenticated: <strong style="color:#e2e8f0;">${user.name || user.id}</strong><br>
          <span style="font-family:monospace; font-size:10px; color:#64748b;">ID: ${shortDid} | TLS 1.3</span>
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:#64748b; cursor:pointer; padding:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    }, 100);
    setTimeout(() => {
      if (toast && toast.parentElement) {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
      }
    }, 6000);
  }
};
window.SecuritySuite = SecuritySuite;
// Expose sync internals for Business Console and other modules
export { LAST_SYNC_STATE, flushOfflineQueue };
// Run database initialization and synchronization once on module load
initDB();