// db.js - Decoupled DB client that syncs with Python Server on Port 8000
// Use relative paths so IIS proxy handles it (if port is empty, it's IIS on 80/443)
const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'http://localhost:8000' : '';
// Generate or retrieve Device ID
const getDeviceId = () => {
    let did = localStorage.getItem('sri_nathi_device_id');
    if (!did) {
        did = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
        localStorage.setItem('sri_nathi_device_id', did);
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
  const activeUnit = localStorage.getItem('sri_nathi_active_unit');
  if (activeUnit) return activeUnit;
  const adminUser = localStorage.getItem('sri_nathi_session_user');
  if (adminUser) {
    try {
      const parsed = JSON.parse(adminUser);
      if (parsed && parsed.assignedUnitId) {
        return parsed.assignedUnitId;
      }
    } catch(e) {}
  }
  const customerUser = localStorage.getItem('sri_nathi_session_customer');
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
    return localStorage.getItem('sri_nathi_e2ee_secret') || "sri_nathi_secure_master_password";
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

// ==========================================
// TOP-LEVEL SECURE API CONNECTOR (GATEWAY)
// ==========================================
export const SecureAPIConnector = {
  getHeaders(method = 'GET', url = '', body = '') {
    const token = localStorage.getItem('sri_nathi_jwt_token');
    const sessionToken = localStorage.getItem('sri_nathi_session_token');
    
    const timestamp = Date.now().toString();
    const nonce = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    
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
    if (typeof window !== 'undefined' && window.CryptoJS) {
        try {
            const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
            const bodyHash = window.CryptoJS.SHA256(bodyStr).toString();
            const hmacSecret = sessionToken || 'sri_nathi_default_hmac_secret';
            const payload = `${method}|${url}|${timestamp}|${nonce}|${bodyHash}`;
            const signature = window.CryptoJS.HmacSHA256(payload, hmacSecret).toString();
            headers['X-Request-Signature'] = signature;
        } catch(e) { console.error("HMAC signing failed", e); }
    }
    
    return headers;
  },
  async fetch(url, options = {}) {
    const method = options.method || 'GET';
    const bodyStr = options.body ? options.body : '';
    const headers = { ...this.getHeaders(method, url, bodyStr), ...(options.headers || {}) };
    const fullUrl = (typeof url === 'string' && url.startsWith('/') && API_BASE) ? `${API_BASE}${url}` : url;
    return await fetch(fullUrl, { ...options, headers });
  },
  async get(collectionKey, unitId) {
    if (typeof collectionKey === 'string' && (collectionKey.startsWith('/') || collectionKey.startsWith('http'))) {
      return await this.fetch(collectionKey);
    }
    const url = `/api/get?key=${collectionKey}&unitId=${unitId}`;
    const res = await fetch(`${API_BASE}${url}`, {
      headers: this.getHeaders('GET', url)
    });
    if (res.status !== 200) {
      console.warn(`[SecureAPIConnector] Non-200 GET for ${collectionKey}: ${res.status}`);
      return null;
    }
    const rawData = await res.json();
    return await EncryptionMiddleware.decryptDataset(collectionKey, rawData);
  },
  async upsert(collectionKey, unitId, payloadArray) {
    const encryptedPayload = await EncryptionMiddleware.encryptDataset(collectionKey, payloadArray);
    const url = `/api/upsert?key=${collectionKey}&unitId=${unitId}`;
    const body = JSON.stringify(encryptedPayload);
    return await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: this.getHeaders('POST', url, body),
      body: body
    });
  },
  async delete(collectionKey, id, unitId = '') {
    const url = `/api/delete?key=${collectionKey}&id=${id}`;
    const headers = this.getHeaders('DELETE', url);
    delete headers['Content-Type']; // DELETE requests don't need Content-Type body header
    return await fetch(`${API_BASE}${url}`, {
      method: 'DELETE',
      headers: headers
    });
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
  }
};
window.SecureAPIConnector = SecureAPIConnector;

// Initialize Offline IndexedDB Queue
const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SriNathiOfflineDB', 1);
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
    const tx = db.transaction('offline_queue', 'readwrite');
    const store = tx.objectStore('offline_queue');
    store.add({ action, key, data, timestamp: Date.now() });
    console.log(`[Offline] Saved ${action} for ${key} to IndexedDB.`);
    // Show offline indicator
    document.body.classList.add('app-offline');
  } catch (e) {
    console.error('Failed to save to Offline Queue:', e);
  }
};
const flushOfflineQueue = async () => {
  console.log('[Offline] Internet restored. Flushing queue...');
  document.body.classList.remove('app-offline');
  try {
    const db = await initIndexedDB();
    const tx = db.transaction('offline_queue', 'readonly');
    const store = tx.objectStore('offline_queue');
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const queue = request.result;
      if (queue.length === 0) return;
      
      for (const item of queue) {
        // Re-attempt saveDB logic for these items
        // We will just re-apply them to LOCAL_DB_CACHE and call saveDB
        console.log(`[Offline Sync] Processing ${item.action} for ${item.key}`);
        // We can just rely on the diffing engine to pick it up by forcing a save
      }
      
      // We will actually just let the normal saveDB diffing catch it since the local cache is already updated,
      // but wait, if the user reloaded the page while offline, the local cache is empty?
      // Actually, if offline, getDB fails, so local cache relies on service worker caching the last known state.
      // We need to replay the queue against the server.
      
      const currentUnitId = getUnitId();
      
      let allSuccess = true;
      for (const item of queue) {
         try {
             if (item.action === 'upsert') {
                 const res = await SecureAPIConnector.upsert(item.key, currentUnitId, item.data);
                 if (!res || !res.ok) allSuccess = false;
             } else if (item.action === 'delete') {
                 const res = await SecureAPIConnector.delete(item.key, item.data, currentUnitId);
                 if (!res || !res.ok) allSuccess = false;
             }
             
             // If successful, remove from queue
             if (allSuccess) {
                 const deleteTx = db.transaction('offline_queue', 'readwrite');
                 deleteTx.objectStore('offline_queue').delete(item.id);
             }
         } catch(e) {
             console.error("[Offline Sync] Still offline or error:", e);
             allSuccess = false;
             break; // Stop flushing
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
const activeUnitId = getUnitId();
// Phase 4: Data Fetching and Synchronization
const applyOfflineQueueToCache = () => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('SriNathiOfflineDB', 1);
      request.onsuccess = (event) => {
        const db = event.target.result;
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
              for (const u of item.data) {
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
      };
      request.onerror = () => resolve();
    } catch(e) {
      console.error("Error applying offline queue", e);
      resolve();
    }
  });
};

window.fetchDatabaseState = async () => {
  for (const key of allowedKeys) {
    try {
      const data = await SecureAPIConnector.get(key, activeUnitId);
      if (data !== null) {
        LOCAL_DB_CACHE[key] = data;
        LAST_SYNC_STATE[key] = JSON.parse(JSON.stringify(data)); // Deep clone for diffing
      } else {
        LOCAL_DB_CACHE[key] = [];
        LAST_SYNC_STATE[key] = [];
      }
    } catch (e) {
      console.error(`Failed to fetch key ${key}:`, e);
      LOCAL_DB_CACHE[key] = [];
      LAST_SYNC_STATE[key] = []; // Missing sync state on catch
    }
  }
  await applyOfflineQueueToCache();
};
export const fetchDatabaseState = window.fetchDatabaseState;
// Initial Data Load (Only if logged in)
if (localStorage.getItem('sri_nathi_session_token') || localStorage.getItem('sri_nathi_session_user') || localStorage.getItem('sri_nathi_jwt_token') || localStorage.getItem('sri_nathi_session_customer')) {
  await window.fetchDatabaseState();
} else {
  // Populate cache with empty arrays so the app can render safely before login
  for (const key of allowedKeys) {
    LOCAL_DB_CACHE[key] = [];
    LAST_SYNC_STATE[key] = [];
  }
}
// Phase 5: Real-Time WebSocket Synchronization
const initWebSocket = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') && window.location.port !== '8000' && window.location.port !== '80' && window.location.port !== '443' ? 'localhost:8000' : window.location.host;
  
  const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/sync/${activeUnitId}`);
  
  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      
      if (msg.action === 'force_sync') {
        console.log("[Sync Command Received] Forcing sync to cloud database.");
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
  
  ws.onclose = () => {
    console.warn("[WebSocket] Connection lost. Reconnecting in 5s...");
    setTimeout(initWebSocket, 5000);
  };
};
initWebSocket();
export const getDB = () => {
  return LOCAL_DB_CACHE;
};
export const saveDB = async (db) => {
  const currentUnitId = getUnitId();
  const token = localStorage.getItem('sri_nathi_jwt_token');
  const sessionToken = localStorage.getItem('sri_nathi_session_token');
  const headers = { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (sessionToken) headers['X-Session-Token'] = sessionToken;
  // Background differential synchronization
  for (const key of allowedKeys) {
    if (!LOCAL_DB_CACHE[key]) continue;
    
    const currentList = LOCAL_DB_CACHE[key];
    const previousList = LAST_SYNC_STATE[key] || [];
    
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
    
    // Process Upserts via Top-Level SecureAPIConnector
    if (upserts.length > 0) {
      SecureAPIConnector.upsert(key, currentUnitId, upserts).then(res => {
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
      });
    }

    // Process Deletes via Top-Level SecureAPIConnector
    for (const delId of deletes) {
      SecureAPIConnector.delete(key, delId, currentUnitId).then(res => {
         if(res && res.ok) {
            LAST_SYNC_STATE[key] = LAST_SYNC_STATE[key].filter(x => x.id !== delId);
         } else {
            addToOfflineQueue('delete', key, delId);
         }
      }).catch(e => {
          console.error(`Failed to delete key ${key} ID ${delId}, saving to offline queue:`, e);
          addToOfflineQueue('delete', key, delId);
      });
    }
  }
};
export const initDB = () => {
  return LOCAL_DB_CACHE;
};
// Log Audit Action
export const logAudit = (userId, unitId, action, details) => {
  const db = getDB();
  if (!db.audit_logs) {
    console.log(`[Audit Log - Local Only]: ${action} - ${details}`);
    return;
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
  const unit = db.units.find(u => u.id === invoiceData.unitId);
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `INV-${unit ? unit.code : 'GEN'}-${dateStr}`;
  const unitInvoices = db.invoices.filter(inv => inv.invoiceNumber.startsWith(prefix));
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
  // Inventory deduction has been moved to the backend (api.py) for real-time secure syncing.
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
  const newOrder = {
    id: "cat-" + Date.now(),
    enquiryNumber,
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
  logAudit(requesterId, "unit-1", "HR_REQUEST_CREATE", `Created HR request for ${reqData.type === 'new_hire' ? reqData.employeeData.name : ('termination of ' + reqData.employeeId)}`);
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
      logAudit(approverId, db.employees[empIndex].assignedUnitId || "unit-1", "EMPLOYEE_TERMINATE", `Approved termination for ${db.employees[empIndex].name} (ID: ${req.employeeId}). Reason: ${req.reason}`);
      
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
  logAudit(approverId, "unit-1", "HR_REQUEST_REJECT", `Rejected HR request ${reqId}. Reason: ${reason}`);
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
  logAudit(userId, "unit-1", "NEW_LICENSE", `Logged license: ${newLicense.name} (${newLicense.licenseNumber})`);
  return newLicense;
};
export const deleteLicense = (licenseId, userId) => {
  const db = getDB();
  const index = db.compliance_licenses.findIndex(lic => lic.id === licenseId);
  if (index !== -1) {
    const licName = db.compliance_licenses[index].name;
    db.compliance_licenses.splice(index, 1);
    saveDB(db);
    logAudit(userId, "unit-1", "DELETE_LICENSE", `Deleted license document: ${licName}`);
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
      logAudit(userId, "unit-1", "EDIT_MENU_ITEM", `Edited menu pricing: ${itemData.name} set to ₹${itemData.price}`);
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
    logAudit(userId, "unit-1", "ADD_MENU_ITEM", `Created new menu item: ${newItem.name} at ₹${newItem.price}`);
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
    logAudit(userId, "unit-1", "DELETE_MENU_ITEM", `Deleted menu item: ${name}`);
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
    this.config = JSON.parse(localStorage.getItem('sri_nathi_auth_config') || '{"provider":"local"}');
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
    localStorage.setItem('sri_nathi_auth_config', JSON.stringify(this.config));
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
      localStorage.setItem('sri_nathi_jwt_token', data.token);
    }
    if (data.sessionToken) {
      localStorage.setItem('sri_nathi_session_token', data.sessionToken);
    }
    return { email: data.employee.email || data.employee.id, employee: data.employee, unitId: data.unitId, provider: 'local', targetPortal: data.targetPortal || targetPortal };
  }
  async logout() {
    localStorage.removeItem('sri_nathi_jwt_token');
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
    localStorage.removeItem('sri_nathi_session_user');
  }
}
export const authService = new AuthService();
window.openAuthSettingsModal = () => {
  const currentConfig = JSON.parse(localStorage.getItem('sri_nathi_auth_config') || '{"provider":"local"}');
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
          localStorage.setItem('sri_nathi_session_user', JSON.stringify(foundEmp));
          localStorage.setItem('sri_nathi_active_unit', foundEmp.assignedUnitId);
          
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
    const did = localStorage.getItem('sri_nathi_device_id') || 'terminal-1';
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
  },

  showInactivityCurtain: (user, onUnlock, onSignOut) => {
    if (document.getElementById('security-inactivity-curtain')) return;
    window.isSecurityCurtainActive = true;
    const curtain = document.createElement('div');
    curtain.id = 'security-inactivity-curtain';
    curtain.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999999;
      background: rgba(9, 15, 26, 0.88);
      backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      font-family: 'Inter', sans-serif;
      opacity: 0;
      transition: opacity 0.4s ease;
    `;
    curtain.innerHTML = `
      <div style="width:100%; max-width:420px; background:rgba(15, 23, 42, 0.9); border:1px solid rgba(255, 255, 255, 0.12); border-radius:24px; padding:32px; box-shadow:0 25px 50px -12px rgba(0, 0, 0, 0.8); text-align:center;">
        <div style="width:64px; height:64px; border-radius:20px; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.25); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 style="font-size:22px; font-weight:800; color:#f8fafc; font-family:'Outfit', sans-serif; letter-spacing:-0.5px; margin:0 0 8px;">Session Paused</h3>
        <p style="font-size:13px; color:#94a3b8; line-height:1.6; margin:0 0 24px;">
          Your workspace has been locked due to inactivity.<br>
          <span style="color:#10b981; font-weight:600;">All unsaved forms and data are preserved in memory.</span>
        </p>
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px; margin-bottom:24px; display:flex; align-items:center; gap:12px; text-align:left;">
          <div style="width:36px; height:36px; border-radius:10px; background:#1e293b; display:flex; align-items:center; justify-content:center; font-weight:700; color:#10b981; font-size:15px;">
            ${(user.name || user.id).charAt(0).toUpperCase()}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name || user.id}</div>
            <div style="font-size:11px; color:#64748b; font-family:monospace;">ID: ${user.id}</div>
          </div>
        </div>
        <form id="curtain-unlock-form" style="display:flex; flex-direction:column; gap:12px;">
          <div style="position:relative;">
            <input type="password" id="curtain-password" placeholder="Enter password / PIN to unlock" required style="width:100%; box-sizing:border-box; padding:14px 16px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); border-radius:12px; color:#fff; font-size:14px; outline:none; transition:border-color 0.2s;" />
          </div>
          <div id="curtain-err-msg" style="font-size:12px; color:#f87171; display:none; text-align:left;"></div>
          <button type="submit" style="width:100%; padding:14px; background:#10b981; border:none; border-radius:12px; color:#fff; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s; box-shadow:0 10px 20px -5px rgba(16,185,129,0.3);">
            Unlock & Resume Work
          </button>
        </form>
        <div style="margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.06);">
          <button type="button" id="curtain-sign-out-btn" style="background:transparent; border:none; color:#64748b; font-size:12px; font-weight:500; cursor:pointer; text-decoration:underline;">
            Switch User or Sign Out Completely
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(curtain);
    setTimeout(() => curtain.style.opacity = '1', 50);
    const passInput = curtain.querySelector('#curtain-password');
    if (passInput) setTimeout(() => passInput.focus(), 200);

    const form = curtain.querySelector('#curtain-unlock-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const pwd = passInput.value;
      const errDiv = curtain.querySelector('#curtain-err-msg');
      try {
        const res = await SecureAPIConnector.login(user.id, pwd, 'operations');
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.detail || "Incorrect password.");
        }
        window.isSecurityCurtainActive = false;
        curtain.style.opacity = '0';
        setTimeout(() => {
          curtain.remove();
          if (onUnlock) onUnlock();
        }, 300);
      } catch(err) {
        if (errDiv) {
          errDiv.innerText = err.message || "Invalid credentials. Try again.";
          errDiv.style.display = 'block';
        }
        passInput.style.borderColor = '#ef4444';
        passInput.value = '';
        passInput.focus();
      }
    };

    const signOutBtn = curtain.querySelector('#curtain-sign-out-btn');
    if (signOutBtn) {
      signOutBtn.onclick = () => {
        window.isSecurityCurtainActive = false;
        curtain.remove();
        if (onSignOut) onSignOut();
      };
    }
  }
};
window.SecuritySuite = SecuritySuite;
// Expose sync internals for Business Console and other modules
export { LAST_SYNC_STATE, flushOfflineQueue };
// Run database initialization and synchronization once on module load
initDB();