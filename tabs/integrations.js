import { getIcons, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';
import { getDB } from '/shared/db.js?v=14';

export const renderIntegrationsTab = () => {
    const icons = getIcons();
    const db = getDB();
    const dbIntegrations = (db.api_integrations || [])[0] || {};
    const config = window.integrationsConfig || dbIntegrations || {};

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>Connected Services & Gateways</h2>
                <p>Manage external payment terminals, cloud database backup storage, notification mail servers, and partner delivery webhooks.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-primary" onclick="window.saveIntegrations()">
                    ${icons.check} Save Configurations
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <!-- Payment Gateway: Pine Labs -->
            <div class="settings-group" style="padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            ${icons.creditCard}
                            <span>Payment Terminal Gateway (Pine Labs Cloud POS)</span>
                        </div>
                        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                            Connects in-store UPI and card processing terminals directly to the billing register.
                        </p>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="window.testIntegrationPing('pine-labs')">
                        Verify Connection
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">Merchant Identifier (MID)</label>
                        <input type="text" id="int-pine-mid" class="form-input" value="${config.pineLabsMerchantId || ''}" placeholder="MERCHANT_ID">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Production API Secret Key</label>
                        <input type="password" id="int-pine-key" class="form-input" value="${config.pineLabsApiKey || ''}" placeholder="PL_LIVE_****************">
                    </div>
                </div>
            </div>

            <!-- Cloud Storage: Microsoft OneDrive -->
            <div class="settings-group" style="padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            ${icons.cloud}
                            <span>Cloud Archive Storage (Microsoft OneDrive)</span>
                        </div>
                        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                            Offsite encrypted database backup snapshots and invoice PDF cold storage.
                        </p>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="window.testIntegrationPing('onedrive')">
                        Verify Connection
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">Application (Client) ID</label>
                        <input type="text" id="int-onedrive-client" class="form-input" value="${config.oneDriveClientId || ''}" placeholder="Azure App Client ID">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tenant ID / Directory Scope</label>
                        <input type="text" id="int-onedrive-tenant" class="form-input" value="${config.oneDriveTenantId || 'common'}" placeholder="common">
                    </div>
                </div>
            </div>

            <!-- Notification Server: SMTP -->
            <div class="settings-group" style="padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div>
                        <div style="font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            ${icons.mail}
                            <span>Notification Mail Server (SMTP)</span>
                        </div>
                        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                            Dispatches automated daily sales summaries, low-stock alerts, and password reset OTPs.
                        </p>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="window.testIntegrationPing('smtp')">
                        Verify Connection
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">SMTP Server Host</label>
                        <input type="text" id="int-smtp-host" class="form-input" value="${config.smtpHost || 'smtp.gmail.com'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Port</label>
                        <input type="number" id="int-smtp-port" class="form-input" value="${config.smtpPort || 587}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sender Email Address</label>
                        <input type="email" id="int-smtp-user" class="form-input" value="${config.smtpUser || 'operations@srinathi.com'}">
                    </div>
                </div>
            </div>

            <!-- Online Delivery Partners -->
            <div class="settings-group" style="padding: 24px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    ${icons.truck}
                    <span>Online Delivery Partner Webhooks</span>
                </div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    Webhook secrets for inbound online orders into the Kitchen Display System (KDS).
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">Online Partner 1 Webhook Signing Secret</label>
                        <input type="password" id="int-swiggy-secret" class="form-input" value="${config.swiggyWebhookSecret || ''}" placeholder="whsec_****************">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Online Partner 2 Webhook Signing Secret</label>
                        <input type="password" id="int-zomato-secret" class="form-input" value="${config.zomatoWebhookSecret || ''}" placeholder="whsec_****************">
                    </div>
                </div>
            </div>
        </div>
    `;
};

// ==========================================
// CONTROLLERS
// ==========================================
window.saveIntegrations = async () => {
    const payload = {
        pineLabsMerchantId: document.getElementById('int-pine-mid').value.trim(),
        pineLabsApiKey: document.getElementById('int-pine-key').value.trim(),
        oneDriveClientId: document.getElementById('int-onedrive-client').value.trim(),
        oneDriveTenantId: document.getElementById('int-onedrive-tenant').value.trim(),
        smtpHost: document.getElementById('int-smtp-host').value.trim(),
        smtpPort: parseInt(document.getElementById('int-smtp-port').value || 587),
        smtpUser: document.getElementById('int-smtp-user').value.trim(),
        swiggyWebhookSecret: document.getElementById('int-swiggy-secret').value.trim(),
        zomatoWebhookSecret: document.getElementById('int-zomato-secret').value.trim()
    };

    showLoading('Saving connected service configurations...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch('/api/business/integrations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            window.integrationsConfig = payload;
            showSuccessOverlay('Connected services saved successfully');
        } else {
            showToast(data.detail || 'Failed to save integrations', 'error');
        }
    } catch (e) {
        showToast('Communication error', 'error');
    } finally {
        hideLoading();
    }
};

window.testIntegrationPing = async (serviceName) => {
    showLoading(`Testing ${serviceName} gateway connection...`);
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch(`/api/business/integrations/test/${serviceName}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`${serviceName.toUpperCase()} connection verified (${data.latencyMs || 42}ms latency)`, 'success');
        } else {
            showToast(data.detail || 'Gateway connection diagnostic failed', 'error');
        }
    } catch (e) {
        showToast('Diagnostic communication error', 'error');
    } finally {
        hideLoading();
    }
};
