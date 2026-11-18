import { API_BASE } from './utils.js';

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

window.cancelLogin = () => {
    document.getElementById('otp-container').style.display = 'none';
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
        
        let data;
        try { data = await res.json(); } catch(err) { data = {}; }
        
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
        
        let data;
        try { data = await res.json(); } catch(err) { data = {}; }
        
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
            body: JSON.stringify({ empId, password, targetPortal: 'admin_console', require_2fa: true })
        });
        
        let data;
        try { data = await res.json(); } catch(err) { data = {}; }

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
        
        let data;
        try { data = await res.json(); } catch(err) { data = {}; }
        
        if (res.ok && data.status === 'success') {
            localStorage.setItem('sri_nathi_session_token', data.sessionToken);
            localStorage.setItem('sri_nathi_jwt_token', data.token);
            localStorage.setItem('sri_nathi_session_user', JSON.stringify(data.employee));
            
            // Trigger Boot Sequence
            document.getElementById('otp-container').style.display = 'none';
            document.getElementById('login-container').style.display = 'none';
            triggerBootSequence(window.renderAppCallback);
        } else {
            errorEl.innerText = data.detail || "Incorrect OTP";
            document.getElementById('otp-btn').innerText = "Verify Identity";
        }
    } catch (e) {
        errorEl.innerText = "Network Error";
        document.getElementById('otp-btn').innerText = "Verify Identity";
    }
};

export const triggerBootSequence = (renderCallback) => {
    const bootLoader = document.getElementById('boot-loader');
    if (bootLoader) bootLoader.style.display = 'none';
    
    // Fetch data
    if (window.fetchDatabaseState) {
        window.fetchDatabaseState();
    }
    
    if (renderCallback) renderCallback();
};

export const initAuth = async (renderCallback) => {
    window.renderAppCallback = renderCallback;
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
                triggerBootSequence(renderCallback);
                return;
            }
        } catch (e) {}
    }
    // If not authenticated, reveal standalone login screen on this domain
    const bootLoader = document.getElementById('boot-loader');
    if (bootLoader) bootLoader.style.display = 'none';
    const loginContainer = document.getElementById('login-container');
    if (loginContainer) loginContainer.style.display = 'flex';
};
