import { getDB } from '/shared/db.js?v=14';
import { formatINR, formatDateTime, getIcons } from '../utils.js';

export const renderPayment_terminalsTab = () => {
    const db = getDB();
    const icons = getIcons();
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{"companyName":"Sri Nathi"}');
    const terminals = settings.payment_terminals || {};
            const units = getDB().units || [];
            let activeUnitFilter = window.paymentTerminalUnitId;
            if (!activeUnitFilter && units.length > 0) activeUnitFilter = units[0].id;
            
            const edcMachines = (terminals.edc_machines || []).filter(m => m.unitId === activeUnitFilter);
            const razorpay = terminals.razorpay || { active: false, keyId: '', keySecret: '' };
            
            return `
                <header class="settings-header-area">
                    <div class="settings-header-title">
                        <h2>Payment Terminals</h2>
                        <p>Manage physical EDC machines and Online Payment Gateways.</p>
                    </div>
                </header>
                <div class="settings-content-area">
                    <div class="settings-group-title" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Physical EDC Terminals (Card/UPI)</span>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="font-size:13px; font-weight:600; color:var(--text-muted);">View Branch:</span>
                            <select class="form-select" style="width:250px; padding:6px; font-size:14px;" onchange="window.paymentTerminalUnitId = this.value; window.renderTabContentDOM();" ${units.length === 0 ? 'disabled' : ''}>
                                ${units.length === 0 ? '<option value="">No branches found</option>' : units.map(u => `<option value="${u.id}" ${activeUnitFilter === u.id ? 'selected' : ''}>${u.id} - ${u.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    ${units.length === 0 ? `
                        <div class="settings-group" style="text-align: center; padding: 60px;">
                            <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:rgba(239,68,68,0.1); color:#ef4444; margin-bottom:16px;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <h3 style="color:#0f172a; margin-bottom:8px;">Please create a Branch first</h3>
                            <p style="color:var(--text-muted); font-size:14px; margin-bottom:24px;">You need to create at least one Branch before you can assign Payment Terminals.</p>
                            <button class="btn btn-primary" onclick="window.navigateTab('branches')">Go to Branches Management</button>
                        </div>
                    ` : `
                        <div class="settings-group">
                            ${edcMachines.length === 0 ? `
                                <div style="padding: 60px; text-align: center; color: var(--text-muted); font-size: 14px;">
                                    <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:rgba(14,165,233,0.1); color:#0ea5e9; margin-bottom:16px;">
                                        ${icons.item}
                                    </div>
                                    <h3 style="color:#0f172a; margin-bottom:8px;">No EDC Machines Configured</h3>
                                    <p style="margin-bottom: 24px;">Click the button below to assign a Card/UPI machine to this branch.</p>
                                    <button class="btn btn-primary" onclick="window.openModal('terminal', 'add')" style="padding: 12px 24px; font-size: 16px;">+ Add Terminal to Branch</button>
                                </div>
                            ` : `
                                ${edcMachines.map((m, idx) => `
                                    <div class="settings-row" style="align-items: center;">
                                        <div class="settings-row-left">
                                            <div class="settings-row-icon" style="background: ${m.provider === 'Pine Labs' ? '#0284c7' : (m.provider === 'Paytm' ? '#0ea5e9' : '#8b5cf6')};">${icons.item}</div>
                                            <div class="settings-row-info">
                                                <div class="settings-row-title">${m.provider} Machine</div>
                                                <div class="settings-row-subtitle">${m.provider === 'Pine Labs' ? `IP: ${m.ip}:${m.port}` : `MID: ${m.tid || 'N/A'}`}</div>
                                            </div>
                                        </div>
                                        <div class="settings-row-right" style="gap: 10px;">
                                            <span class="status-badge badge-active">Active</span>
                                            <button class="row-btn row-btn-danger" onclick="window.deleteTerminal(${idx})">Remove</button>
                                        </div>
                                    </div>
                                `).join('')}
                                <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
                                    <button class="btn btn-secondary" style="font-weight:700;" onclick="window.openModal('terminal', 'add')">+ Add Another Terminal</button>
                                </div>
                            `}
                        </div>
                    `}
                    
                    <div class="settings-group-title" style="margin-top: 3rem;">Online Payment Gateway</div>
                    <div class="settings-group">
                        <div class="settings-row" style="background: #fafafa;">
                            <div class="settings-row-left">
                                <div class="settings-row-icon" style="background: #0ea5e9;">
                                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                </div>
                                <div class="settings-row-info">
                                    <div class="settings-row-title">Razorpay Integration <span class="status-badge badge-blue" style="margin-left:6px; font-size:10px; padding: 2px 6px;">Recommended</span></div>
                                    <div class="settings-row-subtitle">Global credentials for sending SMS payment links to customers.</div>
                                </div>
                            </div>
                            <div class="settings-row-right">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="rzp-active" ${razorpay.active ? 'checked' : ''} onchange="window.saveOnlineGateway()">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-title">Razorpay Key ID</div>
                            </div>
                            <div class="settings-row-right">
                                <input type="text" class="form-input" style="width: 280px;" id="rzp-key" value="${razorpay.keyId}" placeholder="rzp_live_..." onchange="window.saveOnlineGateway()">
                            </div>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-title">Razorpay Key Secret</div>
                            </div>
                            <div class="settings-row-right">
                                <input type="password" class="form-input" style="width: 280px;" id="rzp-secret" value="${razorpay.keySecret}" placeholder="••••••••••••" onchange="window.saveOnlineGateway()">
                            </div>
                        </div>
                    </div>
                    <div class="settings-group-title" style="margin-top: 3rem;">Static QR Webhooks (Google Pay / PhonePe)</div>
                    <div class="settings-group">
                        <div class="settings-row" style="background: #fafafa;">
                            <div class="settings-row-left">
                                <div class="settings-row-icon" style="background: #22c55e;">
                                   ${icons.wallet}
                                </div>
                                <div class="settings-row-info">
                                    <div class="settings-row-title">UPI Auto-Confirm Webhook</div>
                                    <div class="settings-row-subtitle">Listen for incoming Google Pay / PhonePe QR scans in real-time.</div>
                                </div>
                            </div>
                        </div>
                        <div class="settings-row">
                            <div class="settings-row-left">
                                <div class="settings-row-title">Webhook URL</div>
                                <div class="settings-row-subtitle">Paste this into your GPay / PhonePe Business dashboard.</div>
                            </div>
                            <div class="settings-row-right">
                                <input type="text" class="form-input" style="width: 320px; background:#f1f5f9; color:var(--text-muted);" readonly value="https://srinathi.in/api/webhooks/gpay">
                            </div>
                        </div>
                    </div>
                </div>
            `;
};

window.saveOnlineGateway = async () => {
    const active = document.getElementById('rzp-active').checked;
    const keyId = document.getElementById('rzp-key').value;
    const keySecret = document.getElementById('rzp-secret').value;
    
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');
    if (!settings.payment_terminals) settings.payment_terminals = {};
    settings.payment_terminals.razorpay = { active, keyId, keySecret };
    
    window.showLoading('Saving Gateway...');
    try {
        const API_BASE = "";
        await fetch(`${API_BASE}/api/business/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        localStorage.setItem('sri_nathi_settings', JSON.stringify(settings));
        if (window.showToast) window.showToast('Online Gateway settings saved', 'success');
    } catch (e) {
        if (window.showToast) window.showToast('Failed to save gateway', 'error');
    } finally {
        window.hideLoading();
    }
};

window.deleteTerminal = async (index) => {
    if (!confirm('Remove this terminal from the unit?')) return;
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');
    if (settings.payment_terminals && settings.payment_terminals.edc_machines) {
        const db = window.getDB ? window.getDB() : { units: [] };
        const activeUnitFilter = window.paymentTerminalUnitId || (db.units?.length > 0 ? db.units[0].id : 'unit-1');
        let foundCount = -1;
        let globalIndex = -1;
        for (let i = 0; i < settings.payment_terminals.edc_machines.length; i++) {
            if (settings.payment_terminals.edc_machines[i].unitId === activeUnitFilter) {
                foundCount++;
                if (foundCount === index) {
                    globalIndex = i;
                    break;
                }
            }
        }
        
        if (globalIndex > -1) {
            settings.payment_terminals.edc_machines.splice(globalIndex, 1);
            try {
                const API_BASE = "";
                await fetch(`${API_BASE}/api/business/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
                localStorage.setItem('sri_nathi_settings', JSON.stringify(settings));
                if (window.showToast) window.showToast('Terminal removed', 'success');
                if (window.renderTabContentDOM) window.renderTabContentDOM();
            } catch (e) {}
        }
    }
};

window.saveNewTerminal = async () => {
    const provider = document.getElementById('modal-term-provider').value;
    const unitId = document.getElementById('modal-term-unit').value;
    const ip = document.getElementById('modal-term-ip')?.value || '';
    const port = document.getElementById('modal-term-port')?.value || '';
    const tid = document.getElementById('modal-term-tid')?.value || '';
    
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{}');
    if (!settings.payment_terminals) settings.payment_terminals = {};
    if (!settings.payment_terminals.edc_machines) settings.payment_terminals.edc_machines = [];
    
    settings.payment_terminals.edc_machines.push({ provider, unitId, ip, port, tid });
    
    window.showLoading('Adding Terminal...');
    try {
        const API_BASE = "";
        await fetch(`${API_BASE}/api/business/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
        localStorage.setItem('sri_nathi_settings', JSON.stringify(settings));
        window.closeModal();
        if (window.showToast) window.showToast('Terminal added', 'success');
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    } catch (e) {
        if (window.showToast) window.showToast('Failed to add terminal', 'error');
    } finally {
        window.hideLoading();
    }
};
