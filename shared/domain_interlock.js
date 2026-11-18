// shared/domain_interlock.js
// Top-Level Zero-Trust Concurrent Domain Interlock Middleware
// Ensures enterprise administrative portals (Operations, HRMS, Finance) cannot be concurrently operated in unshielded sessions.

(function(global) {
  const STORAGE_KEY = 'sri_nathi_domain_interlock_state';
  const CHANNEL_NAME = 'sri_nathi_domain_interlock_channel';
  
  const DomainInterlock = {
    currentDomain: 'operations',
    channel: null,
    isLocked: false,
    activeRemoteDomain: null,
    
    init(config = {}) {
      if (config.currentDomain) this.currentDomain = config.currentDomain;
      
      // Initialize BroadcastChannel if supported in browser environment
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (e) => this.handleBroadcastMessage(e.data);
      }
      
      // Fallback & dual-sync: listen for localStorage changes across tabs
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === STORAGE_KEY) {
            this.syncStateFromStorage();
          }
        });
        
        // Check if there's already an active interlock on boot
        this.syncStateFromStorage();
        
        // When this domain tab is closed or navigated away, broadcast release if we were the active remote domain
        window.addEventListener('beforeunload', () => {
          this.releaseIfActive();
        });
      }
      
      return this;
    },
    
    handleBroadcastMessage(data) {
      if (!data || !data.type) return;
      
      if (data.type === 'LOCK_ENGAGE') {
        // If another domain engaged a lock originating from us, or general interlock
        if (data.originDomain === this.currentDomain && data.targetDomain !== this.currentDomain) {
          this.engageLockout(data.targetDomain);
        }
      } else if (data.type === 'INTERLOCK_RELEASE') {
        // If the locked remote domain released its session
        if (this.isLocked && (data.releasedDomain === this.activeRemoteDomain || !this.activeRemoteDomain)) {
          this.releaseLockout();
        }
      } else if (data.type === 'FORCE_TERMINATE') {
        // If a remote tab requested emergency termination of this session
        if (data.targetDomain === this.currentDomain || data.targetDomain === 'ALL') {
          this.terminateSelf();
        }
      }
    },
    
    syncStateFromStorage() {
      if (typeof localStorage === 'undefined') return;
      try {
        const raw = SecureStorage.getItem(STORAGE_KEY);
        if (!raw) {
          if (this.isLocked) this.releaseLockout();
          return;
        }
        const state = JSON.parse(raw);
        if (state.locked && state.originDomain === this.currentDomain && state.activeDomain !== this.currentDomain) {
          this.engageLockout(state.activeDomain);
        } else if (!state.locked && this.isLocked) {
          this.releaseLockout();
        }
      } catch (err) {
        console.error('[DomainInterlock] Storage sync error:', err);
      }
    },
    
    lock(targetDomain) {
      this.activeRemoteDomain = targetDomain;
      const state = {
        locked: true,
        originDomain: this.currentDomain,
        activeDomain: targetDomain,
        timestamp: Date.now()
      };
      
      if (typeof localStorage !== 'undefined') {
        SecureStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      
      if (this.channel) {
        this.channel.postMessage({
          type: 'LOCK_ENGAGE',
          originDomain: this.currentDomain,
          targetDomain: targetDomain,
          timestamp: Date.now()
        });
      }
      
      this.engageLockout(targetDomain);
    },
    
    unlock() {
      if (typeof localStorage !== 'undefined') {
        SecureStorage.removeItem(STORAGE_KEY);
      }
      
      if (this.channel) {
        this.channel.postMessage({
          type: 'INTERLOCK_RELEASE',
          releasedDomain: this.currentDomain,
          timestamp: Date.now()
        });
      }
      
      this.releaseLockout();
    },
    
    releaseIfActive() {
      if (typeof localStorage === 'undefined') return;
      try {
        const raw = SecureStorage.getItem(STORAGE_KEY);
        if (raw) {
          const state = JSON.parse(raw);
          if (state.activeDomain === this.currentDomain || (state.activeDomain === 'hrms' && this.currentDomain === 'hrms') || (state.activeDomain === 'finance' && this.currentDomain === 'finance')) {
            this.unlock();
          }
        }
      } catch(e) {}
    },
    
    terminateRemoteSession() {
      if (this.channel) {
        this.channel.postMessage({
          type: 'FORCE_TERMINATE',
          targetDomain: this.activeRemoteDomain || 'ALL',
          timestamp: Date.now()
        });
      }
      // Clear storage lock immediately and unlock origin
      if (typeof localStorage !== 'undefined') {
        SecureStorage.removeItem(STORAGE_KEY);
      }
      this.releaseLockout();
    },
    
    terminateSelf() {
      if (typeof localStorage !== 'undefined') {
        SecureStorage.removeItem('sri_nathi_session_user');
        SecureStorage.removeItem(STORAGE_KEY);
      }
      // Broadcast release just in case
      if (this.channel) {
        this.channel.postMessage({
          type: 'INTERLOCK_RELEASE',
          releasedDomain: this.currentDomain,
          timestamp: Date.now()
        });
      }
      if (typeof window !== 'undefined') {
        alert(" Security Notice: Your session in this window was terminated from the primary Operations Terminal to prevent unauthorized concurrent domain access.");
        try {
          window.close();
        } catch(e) {}
        // Fallback if window.close is blocked by browser policy
        if (document && document.body) {
          document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:#f8fafc; font-family:sans-serif; text-align:center; padding:20px;">
              <h1 style="font-size:28px; color:#ef4444; margin-bottom:12px;"> Session Terminated</h1>
              <p style="max-width:480px; color:#94a3b8; font-size:15px; line-height:1.6;">This administrative domain session was terminated by the primary Operations console to enforce single-domain concurrency security policies. You may now close this tab.</p>
            </div>
          `;
        }
      }
    },
    
    engageLockout(targetDomain) {
      if (this.isLocked) return;
      this.isLocked = true;
      this.activeRemoteDomain = targetDomain;
      this.renderLockoutScreen(targetDomain);
    },
    
    releaseLockout() {
      this.isLocked = false;
      this.activeRemoteDomain = null;
      if (typeof document !== 'undefined') {
        const modal = document.getElementById('domain-interlock-lockout-screen');
        if (modal) {
          modal.style.opacity = '0';
          modal.style.transform = 'scale(0.98)';
          setTimeout(() => modal.remove(), 250);
        }
      }
    },
    
    renderLockoutScreen(targetDomain) {
      if (typeof document === 'undefined') return;
      let modal = document.getElementById('domain-interlock-lockout-screen');
      if (modal) return; // Already visible
      
      const domainName = targetDomain ? targetDomain.toUpperCase() : 'SECONDARY';
      
      modal = document.createElement('div');
      modal.id = 'domain-interlock-lockout-screen';
      modal.style.cssText = 'position: fixed; inset: 0; z-index: 9999999; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); opacity: 0; transform: scale(0.98); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);';
      
      modal.innerHTML = `
        <div style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; padding: 40px; max-width: 520px; width: 90%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1); color: #f8fafc; font-family: 'Outfit', -apple-system, sans-serif;">
          <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; box-shadow: 0 0 25px rgba(239, 68, 68, 0.25);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          
          <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; letter-spacing: 0.5px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 8px #10b981;"></span>
            ACTIVE SESSION: ${domainName} PORTAL (TAB #2)
          </div>
          
          <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 14px 0; color: #ffffff; letter-spacing: -0.5px;">Domain Security Interlock Active</h2>
          
          <p style="font-size: 14.5px; line-height: 1.6; color: #94a3b8; margin: 0 0 32px 0;">
            You have launched the <strong style="color: #f8fafc;">${domainName} Portal</strong> in a separate window. For regulatory compliance and data security, concurrent operation across distinct administrative domains is restricted on this workstation.
          </p>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="btn-interlock-check-status" style="width: 100%; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #f8fafc; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.14)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Check Session Status
            </button>
            
            <button id="btn-interlock-terminate-remote" style="width: 100%; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; background: #ef4444; border: none; color: #ffffff; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 20px -5px rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              Terminate ${domainName} & Resume Operations
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Trigger animation in next frame
      requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      });
      
      const btnCheck = modal.querySelector('#btn-interlock-check-status');
      if (btnCheck) {
        btnCheck.addEventListener('click', () => {
          this.syncStateFromStorage();
          if (!this.isLocked) {
            alert("✅ Session verified closed. Operations unlocked.");
          } else {
            alert(`ℹ️ The ${domainName} Portal session is still active in another tab. Close that tab or click Terminate below.`);
          }
        });
      }
      
      const btnTerminate = modal.querySelector('#btn-interlock-terminate-remote');
      if (btnTerminate) {
        btnTerminate.addEventListener('click', () => {
          const confirmKill = confirm(`Are you sure you want to terminate the remote ${domainName} session and resume operations here?`);
          if (confirmKill) {
            this.terminateRemoteSession();
          }
        });
      }
    }
  };

  // Expose globally
  global.DomainInterlock = DomainInterlock;

})(typeof window !== 'undefined' ? window : globalThis);

// ES Module Export
export const DomainInterlock = (typeof window !== 'undefined' ? window.DomainInterlock : globalThis.DomainInterlock);
export default DomainInterlock;
