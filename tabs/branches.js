import { getDB, saveDB, SecureAPIConnector, logAudit } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';

export const renderBranchesTab = () => {
    const db = getDB();
    const icons = getIcons();
    const units = db.units || [];

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>Business Locations & Hierarchy</h2>
                <p>Manage branch units, GSTIN registrations, FSSAI licenses, seating capacity, and geofencing.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-primary" onclick="window.openBranchModal('add')">
                    ${icons.plus} Add Business Location
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <!-- Branch Location Cards Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;">
                ${units.map(unit => {
                    const isActive = unit.status !== 'INACTIVE' && unit.active !== false;
                    return `
                        <div class="settings-group" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 0;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                    <div>
                                        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${unit.name || 'Branch Unit'}</h3>
                                        <div style="font-size: 12px; color: var(--text-muted); font-family: monospace; margin-top: 2px;">Code: ${unit.id || unit.code}</div>
                                    </div>
                                    <span class="status-badge ${isActive ? 'badge-active' : 'badge-danger'}">
                                        ${isActive ? 'Operational' : 'Inactive'}
                                    </span>
                                </div>

                                <p style="font-size: 13px; color: #475569; margin-bottom: 16px; line-height: 1.4;">
                                    ${unit.address || 'Address not configured'}
                                </p>

                                <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-size: 12.5px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
                                    <div><span style="color: var(--text-muted);">GSTIN:</span> <strong style="font-family: monospace;">${unit.gstin || '-'}</strong></div>
                                    <div><span style="color: var(--text-muted);">FSSAI:</span> <strong style="font-family: monospace;">${unit.fssai || '-'}</strong></div>
                                    <div><span style="color: var(--text-muted);">Table Capacity:</span> <strong>${unit.tableCount || unit.table_count || 12}</strong></div>
                                    <div><span style="color: var(--text-muted);">Contact:</span> <strong>${unit.phone || '-'}</strong></div>
                                </div>

                                <div style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                                    ${icons.branch}
                                    <span>Geofence Radius: <strong>${unit.geofenceRadius || 150} meters</strong></span>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; border-top: 1px solid var(--border-light); padding-top: 16px;">
                                <button class="btn btn-sm btn-secondary" onclick='window.openBranchModal("edit", ${JSON.stringify(unit)})'>
                                    Edit Location
                                </button>
                                <button class="btn btn-sm btn-secondary" style="color: var(--danger);" onclick="window.toggleBranchStatus('${unit.id}', ${!isActive})">
                                    ${isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

// ==========================================
// CONTROLLERS
// ==========================================
window.openBranchModal = (mode, branchData = null) => {
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        document.body.appendChild(modalEl);
    }
    
    const isEdit = mode === 'edit' && branchData;
    const data = branchData || {};
    
    modalEl.innerHTML = `
        <div class="modal-card" style="max-width: 580px;">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Business Location' : 'Add New Business Location'}</h3>
                <button class="close-btn" onclick="window.closeModal()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                    <div class="form-group">
                        <label class="form-label">Branch Code / Unit ID *</label>
                        <input type="text" id="branch-id" class="form-input" value="${data.id || ''}" placeholder="e.g. unit-3" ${isEdit ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Location Name *</label>
                        <input type="text" id="branch-name" class="form-input" value="${data.name || ''}" placeholder="e.g. Sri Nathi - HSR Layout">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 14px;">
                    <label class="form-label">Full Street Address</label>
                    <textarea id="branch-address" class="form-input" rows="2" placeholder="Full postal address">${data.address || ''}</textarea>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                    <div class="form-group">
                        <label class="form-label">GSTIN Number</label>
                        <input type="text" id="branch-gstin" class="form-input" value="${data.gstin || ''}" placeholder="29XXXXX1234X1Z5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">FSSAI License No</label>
                        <input type="text" id="branch-fssai" class="form-input" value="${data.fssai || ''}" placeholder="14-digit FSSAI number">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 24px;">
                    <div class="form-group">
                        <label class="form-label">Phone Contact</label>
                        <input type="text" id="branch-phone" class="form-input" value="${data.phone || ''}" placeholder="Contact phone">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Table Count</label>
                        <input type="number" id="branch-tables" class="form-input" value="${data.tableCount || data.table_count || 12}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Geofence (Meters)</label>
                        <input type="number" id="branch-geofence" class="form-input" value="${data.geofenceRadius || 150}">
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveBranch('${mode}')">Save Location</button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};

window.saveBranch = async (mode) => {
    const id = document.getElementById('branch-id').value.trim();
    const name = document.getElementById('branch-name').value.trim();
    const address = document.getElementById('branch-address').value.trim();
    const gstin = document.getElementById('branch-gstin').value.trim();
    const fssai = document.getElementById('branch-fssai').value.trim();
    const phone = document.getElementById('branch-phone').value.trim();
    const tableCount = parseInt(document.getElementById('branch-tables').value || 12);
    const geofenceRadius = parseInt(document.getElementById('branch-geofence').value || 150);

    if (!id || !name) {
        showToast('Branch code and name are required', 'error');
        return;
    }

    const payload = { id, name, address, gstin, fssai, phone, tableCount, table_count: tableCount, geofenceRadius, active: true, status: 'ACTIVE' };

    showLoading('Saving branch location record...');
    try {
        const db = getDB();
        db.units = db.units || [];
        const idx = db.units.findIndex(u => u.id === id);
        if (idx >= 0) db.units[idx] = { ...db.units[idx], ...payload };
        else db.units.push(payload);

        await SecureAPIConnector.upsert('units', id, payload);
        await saveDB(db);
        window.closeModal();
        showSuccessOverlay('Business location saved successfully');
    } catch (e) {
        showToast('Failed to save business location', 'error');
    } finally {
        hideLoading();
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    }
};

window.toggleBranchStatus = async (branchId, newStatus) => {
    const db = getDB();
    if (db.units) {
        const unit = db.units.find(u => u.id === branchId);
        if (unit) {
            unit.active = newStatus;
            unit.status = newStatus ? 'ACTIVE' : 'INACTIVE';
            showLoading('Updating location operating status...');
            try {
                await SecureAPIConnector.upsert('units', branchId, unit);
                await saveDB(db);
                showToast(`Location ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
            } catch (e) {
                showToast('Failed to update status', 'error');
            } finally {
                hideLoading();
                if (window.renderTabContentDOM) window.renderTabContentDOM();
            }
        }
    }
};
