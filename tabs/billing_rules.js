import { getDB, saveDB } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';

export const renderBillingRulesTab = () => {
    const icons = getIcons();
    const config = window.billingConfig || {
        invoicePrefixFormula: 'SN-{BRANCH}-{YYYY}/',
        nextInvoiceSeq: 1001,
        defaultGstRate: 5.0,
        enableDineInServiceCharge: false,
        dineInServiceChargeRate: 2.5,
        packagingFeeTakeaway: 10.0,
        deliverySurcharge: 15.0,
        cashierMaxDiscountPercent: 5.0,
        managerMaxDiscountPercent: 20.0,
        roundOffMode: 'NEAREST_RUPEE',
        autoDiscountThreshold: 2000.0,
        autoDiscountPercent: 5.0
    };

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>Tax, Billing & Invoicing Policies</h2>
                <p>Configure automated invoice numbering sequences, GST tax tiers, surcharge fees, and discount authorization limits.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-primary" onclick="window.saveBillingRules()">
                    ${icons.check} Save Policies
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <!-- Invoice Sequencing Section -->
            <div class="settings-group" style="padding: 24px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                    Automated Invoice Numbering Sequence
                </div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    Define the prefix structure used by Point of Sale registers when generating official tax invoices.
                </p>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label class="form-label">Invoice Prefix Formula</label>
                        <input type="text" id="bill-prefix" class="form-input" value="${config.invoicePrefixFormula || 'SN-{BRANCH}-{YYYY}/'}" placeholder="SN-{BRANCH}-{YYYY}/">
                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">Supported tokens: <code>{BRANCH}</code>, <code>{YYYY}</code>, <code>{MM}</code></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Next Sequence Index</label>
                        <input type="number" id="bill-seq" class="form-input" value="${config.nextInvoiceSeq || 1001}">
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #334155; display: flex; align-items: center; justify-content: space-between;">
                    <span>Generated Invoice Example:</span>
                    <strong style="font-family: monospace; font-size: 14px; color: var(--accent);">SN-MAIN-${new Date().getFullYear()}/00${config.nextInvoiceSeq || 1001}</strong>
                </div>
            </div>

            <!-- Tax Slabs & Surcharges -->
            <div class="settings-group" style="padding: 24px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                    Tax Slabs & Operational Surcharges
                </div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    Standard statutory GST rates and mandatory packaging or delivery surcharges.
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label class="form-label">Default GST Tax Tier</label>
                        <select id="bill-gst-tier" class="form-select">
                            <option value="5.0" ${config.defaultGstRate == 5 ? 'selected' : ''}>5.0% (Standard F&B GST)</option>
                            <option value="12.0" ${config.defaultGstRate == 12 ? 'selected' : ''}>12.0% (Packaged Food GST)</option>
                            <option value="18.0" ${config.defaultGstRate == 18 ? 'selected' : ''}>18.0% (Outdoor Catering GST)</option>
                            <option value="0.0" ${config.defaultGstRate == 0 ? 'selected' : ''}>0.0% (Exempt)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Takeaway Packaging Fee (₹)</label>
                        <input type="number" id="bill-packaging" class="form-input" value="${config.packagingFeeTakeaway || 10}" step="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Delivery Handling Fee (₹)</label>
                        <input type="number" id="bill-delivery" class="form-input" value="${config.deliverySurcharge || 15}" step="1">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">Dine-in Service Charge (%)</label>
                        <input type="number" id="bill-service-charge" class="form-input" value="${config.dineInServiceChargeRate || 2.5}" step="0.5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Invoice Currency Round-off</label>
                        <select id="bill-round-off" class="form-select">
                            <option value="NEAREST_RUPEE">Round to Nearest ₹1.00</option>
                            <option value="ROUND_UP">Always Round Up (+ ₹1.00)</option>
                            <option value="EXACT_PAISE">Exact (2 Decimal Places)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Discount Authorization Limits -->
            <div class="settings-group" style="padding: 24px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                    Discount Governance & Authorization Thresholds
                </div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    Set maximum allowable discount percentages that can be granted by staff roles without executive escalation.
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                        <label class="form-label">Cashier Maximum Discount Limit (%)</label>
                        <input type="number" id="bill-cashier-discount" class="form-input" value="${config.cashierMaxDiscountPercent || 5}" max="20">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Manager Maximum Discount Limit (%)</label>
                        <input type="number" id="bill-manager-discount" class="form-input" value="${config.managerMaxDiscountPercent || 20}" max="50">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">Automatic Order Discount Threshold (₹)</label>
                        <input type="number" id="bill-auto-threshold" class="form-input" value="${config.autoDiscountThreshold || 2000}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Automatic Discount Applied (%)</label>
                        <input type="number" id="bill-auto-discount" class="form-input" value="${config.autoDiscountPercent || 5}">
                    </div>
                </div>
            </div>
        </div>
    `;
};

// ==========================================
// CONTROLLERS
// ==========================================
window.saveBillingRules = async () => {
    const payload = {
        invoicePrefixFormula: document.getElementById('bill-prefix').value.trim(),
        nextInvoiceSeq: parseInt(document.getElementById('bill-seq').value || 1001),
        defaultGstRate: parseFloat(document.getElementById('bill-gst-tier').value || 5.0),
        packagingFeeTakeaway: parseFloat(document.getElementById('bill-packaging').value || 0),
        deliverySurcharge: parseFloat(document.getElementById('bill-delivery').value || 0),
        dineInServiceChargeRate: parseFloat(document.getElementById('bill-service-charge').value || 0),
        roundOffMode: document.getElementById('bill-round-off').value,
        cashierMaxDiscountPercent: parseFloat(document.getElementById('bill-cashier-discount').value || 5),
        managerMaxDiscountPercent: parseFloat(document.getElementById('bill-manager-discount').value || 20),
        autoDiscountThreshold: parseFloat(document.getElementById('bill-auto-threshold').value || 2000),
        autoDiscountPercent: parseFloat(document.getElementById('bill-auto-discount').value || 5)
    };

    showLoading('Updating tax and billing policies in database...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch('/api/business/billing-rules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            window.billingConfig = payload;
            showSuccessOverlay('Tax & Billing policies saved successfully');
        } else {
            showToast(data.detail || 'Failed to update billing policies', 'error');
        }
    } catch (e) {
        showToast('Communication error during policy save', 'error');
    } finally {
        hideLoading();
    }
};
