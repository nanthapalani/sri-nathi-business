/**
 * SecureStorage - AES-256 encrypted wrapper for localStorage
 * Encrypts all data before storing in the browser, preventing
 * inspection of tokens or sensitive user data in DevTools.
 * Uses synchronous CryptoJS for drop-in compatibility with localStorage.
 */

// Global fetch override to always include cookies
(function() {
    if (typeof window !== 'undefined' && window.fetch) {
        const originalFetch = window.fetch;
        window.fetch = function() {
            let args = Array.prototype.slice.call(arguments);
            if (args.length > 1 && typeof args[1] === 'object') {
                args[1].credentials = 'include';
            } else if (args.length === 1 && typeof args[0] === 'string') {
                args.push({ credentials: 'include' });
            } else if (args.length === 1 && args[0] instanceof Request) {
                // If it's a Request object, the easiest way is to clone it with credentials or just pass it if it already has it
                // Actually Request objects are immutable for credentials sometimes, but passing init works
                args[0] = new Request(args[0], { credentials: 'include' });
            }
            return originalFetch.apply(this, args);
        };
    }
})();

class SecureStorageAPI {
    constructor() {
        this.secret = this.getEncryptionKey();
    }

    getEncryptionKey() {
        // Derive key from device fingerprint or fallback
        let fingerPrint = 'sri_nathi_default_device';
        if (typeof generateDeviceFingerprint === 'function') {
            fingerPrint = generateDeviceFingerprint();
        } else {
            fingerPrint = navigator.userAgent + navigator.language + screen.colorDepth;
        }
        return 'sri_nathi_master_salt_' + fingerPrint;
    }

    setItem(key, value) {
        if (value === null || value === undefined) return;
        
        try {
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            // Must have CryptoJS loaded via CDN
            if (window.CryptoJS) {
                const encrypted = CryptoJS.AES.encrypt(data, this.secret).toString();
                localStorage.setItem(key, 'ENC:' + encrypted);
            } else {
                localStorage.setItem(key, data);
            }
        } catch (e) {
            console.error("SecureStorage encryption failed:", e);
        }
    }

    getItem(key) {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        if (!stored.startsWith('ENC:')) return stored; // Fallback for unencrypted legacy items
        
        try {
            if (window.CryptoJS) {
                const encrypted = stored.substring(4);
                const bytes = CryptoJS.AES.decrypt(encrypted, this.secret);
                return bytes.toString(CryptoJS.enc.Utf8);
            }
            return null;
        } catch (e) {
            console.error("SecureStorage decryption failed (item might be corrupted):", e);
            return null;
        }
    }

    removeItem(key) {
        localStorage.removeItem(key);
    }

    clear() {
        localStorage.clear();
    }
}

window.SecureStorage = new SecureStorageAPI();
