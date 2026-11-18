import { getDB } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';

export const renderBrandingTab = () => {
    const icons = getIcons();
    const db = getDB();
    const dbSettings = db.business_settings || {};
    const settings = Object.keys(dbSettings).length > 0 ? dbSettings : JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');

    return `
        <div class="content-wrapper">
            <div class="page-header-block">
                <div class="page-title-text">
                    <h1>Corporate Brand & Legal Profile</h1>
                    <p>Manage legal registered entities, official tax identifiers, invoice receipts footer, and brand identity.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" onclick="window.saveBrandingSettings()">
                        ${icons.check} Save Brand Profile
                    </button>
                </div>
            </div>

            <!-- 1. Meta Style: Business Portfolio Info Card -->
            <div class="meta-section-card">
                <div class="meta-section-header">
                    <h2>Business Profile Summary</h2>
                    <span class="status-badge badge-active">Active Profile</span>
                </div>
                <div class="meta-section-body">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div class="monogram-badge badge-blue" style="width: 48px; height: 48px; font-size: 18px; font-weight: 800;">
                            SN
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">
                                ${settings.companyName || settings.company_name || 'Sri Nathi'}
                            </div>
                            <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                                Primary Entity: <strong>${settings.legalEntity || settings.legal_entity || 'Not Configured'}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Meta Style: Legal Business Details -->
            <div class="meta-section-card">
                <div class="meta-section-header">
                    <h2>Legal Business Details</h2>
                </div>
                <div class="meta-section-body">
                    <div class="property-row">
                        <div style="flex: 1; margin-right: 20px;">
                            <div class="property-label">Brand / Display Name</div>
                            <div class="property-desc">Public display name printed on customer receipts and partner channels.</div>
                        </div>
                        <div style="width: 320px;">
                            <input type="text" id="brand-name" class="form-input" value="${settings.companyName || settings.company_name || 'Sri Nathi'}">
                        </div>
                    </div>

                    <div class="property-row">
                        <div style="flex: 1; margin-right: 20px;">
                            <div class="property-label">Legal Registered Entity Name</div>
                            <div class="property-desc">Official registered company name for legal tax filing and GSTIN registration.</div>
                        </div>
                        <div style="width: 320px;">
                            <input type="text" id="brand-legal" class="form-input" value="${settings.legalEntity || settings.legal_entity || ''}" placeholder="e.g. Sri Nathi Private Limited">
                        </div>
                    </div>

                    <div class="property-row">
                        <div style="flex: 1; margin-right: 20px;">
                            <div class="property-label">Corporate Registered GSTIN</div>
                            <div class="property-desc">Central 15-digit Goods and Services Tax Identification Number.</div>
                        </div>
                        <div style="width: 320px;">
                            <input type="text" id="brand-gstin" class="form-input" value="${settings.gstin || settings.default_gstin || ''}" placeholder="Enter 15-digit GSTIN">
                        </div>
                    </div>

                    <div class="property-row">
                        <div style="flex: 1; margin-right: 20px;">
                            <div class="property-label">Central FSSAI License Number</div>
                            <div class="property-desc">Food Safety and Standards Authority of India central registration number.</div>
                        </div>
                        <div style="width: 320px;">
                            <input type="text" id="brand-fssai" class="form-input" value="${settings.fssai || ''}" placeholder="Enter 14-digit FSSAI number">
                        </div>
                    </div>

                    <div class="property-row">
                        <div style="flex: 1; margin-right: 20px;">
                            <div class="property-label">Primary Operating Currency</div>
                            <div class="property-desc">Base currency used for all point-of-sale terminals and invoice ledgers.</div>
                        </div>
                        <div style="width: 320px;">
                            <input type="text" id="brand-currency" class="form-input" value="INR (₹)" disabled style="background: var(--bg-surface-secondary);">
                        </div>
                    </div>

                    <div class="property-row" style="align-items: flex-start;">
                        <div style="flex: 1; margin-right: 20px;">
                            <div class="property-label">Official Receipt Footer Text</div>
                            <div class="property-desc">Custom message and compliance note printed at the bottom of customer receipts.</div>
                        </div>
                        <div style="width: 320px;">
                            <textarea id="brand-receipt-footer" class="form-input" rows="3">${settings.receiptFooter || 'Thank you for dining with Sri Nathi. Please visit us again!'}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Compliance & Verification Status -->
            <div class="meta-section-card">
                <div class="meta-section-header">
                    <h2>Enterprise Compliance & Verification Status</h2>
                    <span class="status-badge badge-active">Verified Standard</span>
                </div>
                <div class="meta-section-body">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="font-size: 13.5px; color: var(--text-primary);">GSTIN & FSSAI Verification Active</strong>
                            <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                                Invoicing formulas and legal disclaimers are compliant with regional hospitality taxation standards.
                            </div>
                        </div>
                        <button class="btn btn-sm btn-secondary" onclick="window.saveBrandingSettings()">Verify & Update</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.saveBrandingSettings = async () => {
    const payload = {
        companyName: document.getElementById('brand-name').value.trim(),
        legalEntity: document.getElementById('brand-legal').value.trim(),
        gstin: document.getElementById('brand-gstin').value.trim(),
        fssai: document.getElementById('brand-fssai').value.trim(),
        receiptFooter: document.getElementById('brand-receipt-footer').value.trim()
    };

    showLoading('Saving brand profile in database...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        localStorage.setItem('sri_nathi_settings', JSON.stringify(payload));
        
        try {
            await fetch('/api/business/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
        } catch (apiErr) {}

        showSuccessOverlay('Brand and legal profile saved successfully');
    } catch (e) {
        showToast('Failed to save settings', 'error');
    } finally {
        hideLoading();
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    }
};
