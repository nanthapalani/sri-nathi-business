/**
 * Session Guard - Inactivity Monitor & Screen Lock
 * Tracks user activity and automatically locks the screen or logs out
 * after predefined periods of inactivity.
 */

class SessionGuard {
    constructor() {
        this.WARNING_TIMEOUT = 13 * 60 * 1000; // 13 minutes
        this.LOCK_TIMEOUT = 15 * 60 * 1000;    // 15 minutes
        this.LOGOUT_TIMEOUT = 30 * 60 * 1000;  // 30 minutes
        
        this.lastActivity = Date.now();
        this.isLocked = false;
        this.warningShown = false;
        
        this.intervalId = null;
        this.init();
    }

    init() {
        // Feature Scope Guard:
        // Inactivity Screen Auto-Lock is strictly scoped to the Business Console / Admin portals.
        // It must NOT run on Operations Portal (Kitchen, POS, Billing, Dispatch tables require persistent live screens).
        const currentPath = (window.location.pathname || '').toLowerCase();
        const isOperationsPortal = currentPath.includes('operation') || 
                                   currentPath === '/' || 
                                   currentPath.endsWith('operations.html') || 
                                   currentPath.endsWith('index_operations.html');
        if (isOperationsPortal) {
            // Disarm and permanently clear any leftover lock flag on operations portal
            try {
                sessionStorage.removeItem('sri_nathi_session_locked');
                localStorage.removeItem('sri_nathi_session_locked');
            } catch(e) {}
            return;
        }

        // Track user activity across events
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(evt => {
            document.addEventListener(evt, () => this.updateActivity(), { passive: true });
        });

        this.injectLockScreenStyles();

        // Restore locked state and activity timestamps from storage
        try {
            const token = (window.SecureStorage && SecureStorage.getItem('sri_nathi_jwt_token')) ||
                          localStorage.getItem('sri_nathi_jwt_token') ||
                          sessionStorage.getItem('sri_nathi_jwt_token');
            const sessionUser = (window.SecureStorage && SecureStorage.getItem('sri_nathi_session_user')) ||
                                localStorage.getItem('sri_nathi_session_user') ||
                                sessionStorage.getItem('sri_nathi_session_user');

            if (!token || !sessionUser) {
                // Not logged in; nothing to guard
                return;
            }

            const isAlreadyLocked = (sessionStorage.getItem('sri_nathi_session_locked') === 'true') ||
                                    (localStorage.getItem('sri_nathi_session_locked') === 'true');
            const savedLastActivity = parseInt(localStorage.getItem('sri_nathi_last_activity') || sessionStorage.getItem('sri_nathi_last_activity') || '0', 10);
            
            if (isAlreadyLocked) {
                this.lockScreen();
            } else if (savedLastActivity > 0) {
                const elapsed = Date.now() - savedLastActivity;
                if (elapsed >= this.LOGOUT_TIMEOUT) {
                    this.forceLogout();
                    return;
                } else if (elapsed >= this.LOCK_TIMEOUT) {
                    this.lockScreen();
                } else {
                    this.lastActivity = savedLastActivity;
                }
            } else {
                this.updateActivity();
            }
        } catch(e) {}

        // Start background verification interval
        this.startChecking();
    }

    startChecking() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.checkInactivity(), 10000); // Check every 10s
    }

    updateActivity() {
        if (this.isLocked) return;
        this.lastActivity = Date.now();
        try {
            localStorage.setItem('sri_nathi_last_activity', String(this.lastActivity));
            sessionStorage.setItem('sri_nathi_last_activity', String(this.lastActivity));
        } catch(e) {}
        
        if (this.warningShown) {
            this.hideWarning();
        }
    }

    checkInactivity() {
        if (this.isLocked) {
            const timeSinceActivity = Date.now() - this.lastActivity;
            if (timeSinceActivity >= this.LOGOUT_TIMEOUT) {
                this.forceLogout();
            }
            return;
        }

        // Don't monitor if not logged in
        const token = (window.SecureStorage && SecureStorage.getItem('sri_nathi_jwt_token')) ||
                      localStorage.getItem('sri_nathi_jwt_token') ||
                      sessionStorage.getItem('sri_nathi_jwt_token');
        if (!token) {
            return;
        }

        const timeSinceActivity = Date.now() - this.lastActivity;

        if (timeSinceActivity >= this.LOCK_TIMEOUT) {
            this.lockScreen();
        } else if (timeSinceActivity >= this.WARNING_TIMEOUT && !this.warningShown) {
            this.showWarning();
        }
    }

    showWarning() {
        if (this.isLocked || document.getElementById('session-warning-toast')) return;
        this.warningShown = true;
        const toast = document.createElement('div');
        toast.id = 'session-warning-toast';
        toast.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 99999; font-family: sans-serif; display: flex; align-items: center; gap: 12px; animation: slideIn 0.3s ease;">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <div>
                    <strong>Inactivity Warning</strong><br/>
                    Your session will lock in 2 minutes.
                </div>
            </div>
        `;
        document.body.appendChild(toast);
    }

    hideWarning() {
        this.warningShown = false;
        const toast = document.getElementById('session-warning-toast');
        if (toast) toast.remove();
    }

    lockScreen() {
        const currentPath = (window.location.pathname || '').toLowerCase();
        if (currentPath.includes('operation') || currentPath === '/' || currentPath.endsWith('operations.html') || currentPath.endsWith('index_operations.html')) {
            try {
                sessionStorage.removeItem('sri_nathi_session_locked');
                localStorage.removeItem('sri_nathi_session_locked');
            } catch(e) {}
            return;
        }

        this.isLocked = true;
        this.hideWarning();
        
        try {
            sessionStorage.setItem('sri_nathi_session_locked', 'true');
            localStorage.setItem('sri_nathi_session_locked', 'true');
        } catch(e) {}

        if (document.getElementById('session-lock-overlay')) {
            return;
        }

        let userProfile = null;
        try {
            const raw = (window.SecureStorage && SecureStorage.getItem('sri_nathi_session_user')) ||
                        localStorage.getItem('sri_nathi_session_user') ||
                        sessionStorage.getItem('sri_nathi_session_user');
            if (raw) userProfile = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch(e) {}
        
        const userName = userProfile ? (userProfile.name || userProfile.employee?.name || 'User') : 'User';
        const empId = userProfile ? (userProfile.id || userProfile.empId || userProfile.emp_id || (userProfile.employee && (userProfile.employee.id || userProfile.employee.empId))) : '';

        const lockOverlay = document.createElement('div');
        lockOverlay.id = 'session-lock-overlay';
        lockOverlay.innerHTML = `
            <div class="lock-container">
                <div class="lock-box">
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 16px; color: var(--primary, #06b6d4);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    <h2 class="lock-title">Session Locked</h2>
                    <p class="lock-desc">${userName}, please enter your password to unlock.</p>
                    
                    <form id="unlock-form" style="display: flex; flex-direction: column; gap: 16px;">
                        <input type="password" id="unlock-password" placeholder="Enter Password" required autocomplete="current-password">
                        <div id="unlock-error" style="color: #ef4444; font-size: 13px; display: none; text-align: left;">Invalid password</div>
                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <button type="button" id="unlock-switch-user">Switch User</button>
                            <button type="submit" id="unlock-submit-btn">Unlock</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(lockOverlay);
        
        // Focus password field
        setTimeout(() => {
            const pwdField = document.getElementById('unlock-password');
            if (pwdField) pwdField.focus();
        }, 100);

        // Handle unlock submission
        const form = document.getElementById('unlock-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('unlock-password').value;
            const errDiv = document.getElementById('unlock-error');
            const submitBtn = document.getElementById('unlock-submit-btn');
            
            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = 'Verifying...';
                }
                if (errDiv) errDiv.style.display = 'none';

                const token = (window.SecureStorage && SecureStorage.getItem('sri_nathi_jwt_token')) ||
                              localStorage.getItem('sri_nathi_jwt_token') ||
                              sessionStorage.getItem('sri_nathi_jwt_token');

                let res = await fetch('/api/auth/unlock', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ password })
                }).catch(() => null);

                // Fallback to /api/auth/login if /api/auth/unlock endpoint is unavailable
                if ((!res || res.status === 404) && empId) {
                    res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            empId: String(empId),
                            password: password,
                            targetPortal: 'operations',
                            require_2fa: false
                        })
                    }).catch(() => null);
                }

                if (!res || !res.ok) {
                    const data = res ? await res.json().catch(() => ({})) : {};
                    if (res && res.status === 401 && !data.detail?.includes("Invalid")) {
                        // Full session expiry
                        alert("Session expired. Please sign in again.");
                        this.forceLogout();
                        return;
                    }
                    throw new Error(data.detail || "Invalid password");
                }

                const data = await res.json().catch(() => ({}));
                if (data.token) {
                    try {
                        localStorage.setItem('sri_nathi_jwt_token', data.token);
                        sessionStorage.setItem('sri_nathi_jwt_token', data.token);
                        if (window.SecureStorage) window.SecureStorage.setItem('sri_nathi_jwt_token', data.token);
                    } catch(e) {}
                }
                if (data.sessionToken) {
                    try {
                        localStorage.setItem('sri_nathi_session_token', data.sessionToken);
                        sessionStorage.setItem('sri_nathi_session_token', data.sessionToken);
                        if (window.SecureStorage) window.SecureStorage.setItem('sri_nathi_session_token', data.sessionToken);
                    } catch(e) {}
                }

                // Unlock success
                this.isLocked = false;
                this.lastActivity = Date.now();
                try {
                    sessionStorage.removeItem('sri_nathi_session_locked');
                    localStorage.removeItem('sri_nathi_session_locked');
                    localStorage.setItem('sri_nathi_last_activity', String(this.lastActivity));
                    sessionStorage.setItem('sri_nathi_last_activity', String(this.lastActivity));
                } catch(e) {}
                lockOverlay.remove();
            } catch (err) {
                if (errDiv) {
                    errDiv.textContent = err.message || "Invalid password";
                    errDiv.style.display = 'block';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Unlock';
                }
            }
        });
        
        // Handle Switch User: Purge session thoroughly and redirect to login
        const switchBtn = document.getElementById('unlock-switch-user');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                this.forceLogout();
            });
        }
    }

    async forceLogout() {
        try {
            const { authService } = await import('./db.js');
            if (authService && authService.logout) {
                await authService.logout();
            }
        } catch(e) {
            console.warn("authService.logout warning:", e);
        }

        // Comprehensive wipe across all storage layers
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
            try { if (window.SecureStorage) window.SecureStorage.removeItem(k); } catch(e) {}
        });
        try { sessionStorage.clear(); } catch(e) {}

        // Expire session and auth cookies
        try {
            document.cookie = "sri_nathi_jwt_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
            document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
            document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
        } catch(e) {}

        try {
            sessionStorage.setItem('sri_nathi_valid_login_path', '/universal_login.html');
        } catch(e) {}

        // Explicitly replace with universal_login.html so browser back cannot revive session
        window.location.replace('/universal_login.html?switch_user=1&cb=' + Date.now());
    }

    injectLockScreenStyles() {
        if (document.getElementById('session-lock-styles')) return;
        const style = document.createElement('style');
        style.id = 'session-lock-styles';
        style.textContent = `
            #session-lock-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.78);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                z-index: 999999;
                display: flex; align-items: center; justify-content: center;
                font-family: var(--font-primary, system-ui, -apple-system, sans-serif);
                padding: 20px;
                box-sizing: border-box;
            }
            #session-lock-overlay .lock-box {
                background: var(--bg-card, #ffffff);
                color: var(--text-main, #111827);
                padding: 36px 32px;
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border, rgba(255,255,255,0.1));
                border: 1px solid var(--border, #e5e7eb);
                width: 100%;
                max-width: 420px;
                text-align: center;
                animation: lockPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #session-lock-overlay .lock-title {
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 8px;
                color: var(--text-main, #111827);
            }
            #session-lock-overlay .lock-desc {
                color: var(--text-secondary, #6b7280);
                font-size: 14px;
                line-height: 1.5;
                margin-bottom: 24px;
            }
            #session-lock-overlay input#unlock-password {
                width: 100%;
                padding: 12px 16px;
                background: var(--bg-main, #f9fafb);
                color: var(--text-main, #111827);
                border: 1px solid var(--border, #d1d5db);
                border-radius: 10px;
                font-size: 15px;
                box-sizing: border-box;
                outline: none;
                transition: all 0.2s;
            }
            #session-lock-overlay input#unlock-password:focus {
                border-color: var(--primary, #06b6d4);
                box-shadow: 0 0 0 3px var(--primary-light, rgba(6, 182, 212, 0.2));
            }
            #session-lock-overlay button#unlock-switch-user {
                flex: 1;
                padding: 12px;
                background: var(--bg-subtle, #f3f4f6);
                color: var(--text-secondary, #374151);
                border: 1px solid var(--border, #e5e7eb);
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            #session-lock-overlay button#unlock-switch-user:hover {
                background: var(--bg-hover, #e5e7eb);
                color: var(--text-main, #111827);
            }
            #session-lock-overlay button[type="submit"] {
                flex: 1;
                padding: 12px;
                background: var(--primary, #06b6d4);
                color: #ffffff;
                border: none;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            #session-lock-overlay button[type="submit"]:hover {
                filter: brightness(1.1);
            }
            @keyframes lockPop {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize globally
window.sessionGuard = new SessionGuard();
