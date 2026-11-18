import { getDB, saveDB, SecureAPIConnector, logAudit } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';

export const renderAccessTab = () => {
    const db = getDB();
    const icons = getIcons();
    const rawEmployees = db.employees || [];
    
    // Deduplicate employees by ID
    const uniqueEmployeesMap = new Map();
    rawEmployees.forEach(emp => {
        const id = emp.id || emp.empId;
        if (id && !uniqueEmployeesMap.has(id)) {
            uniqueEmployeesMap.set(id, emp);
        }
    });
    const employees = Array.from(uniqueEmployeesMap.values());

    // Matrix definitions
    const roles = ['Top Management', 'Branch Manager', 'Accountant', 'Cashier', 'Kitchen Staff'];
    const modules = [
        { key: 'pos', label: 'Point of Sale & Billing' },
        { key: 'reports', label: 'Financial & Sales Analytics' },
        { key: 'menu', label: 'Catalog & Price Editing' },
        { key: 'expenses', label: 'Expense & Petty Cash Entry' },
        { key: 'settings', label: 'Global Administration & Settings' }
    ];

    const matrix = window.rbacMatrix || {
        'Top Management': { pos: true, reports: true, menu: true, expenses: true, settings: true },
        'Branch Manager': { pos: true, reports: true, menu: true, expenses: true, settings: false },
        'Accountant': { pos: false, reports: true, menu: false, expenses: true, settings: false },
        'Cashier': { pos: true, reports: false, menu: false, expenses: false, settings: false },
        'Kitchen Staff': { pos: false, reports: false, menu: false, expenses: false, settings: false }
    };

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>User Roles & Access Permissions</h2>
                <p>Role-based access matrix, terminal device bindings, and staff account lifecycle management.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-secondary" onclick="window.openAddStaffModal()">
                    ${icons.plus} Add Staff Member
                </button>
                <button class="btn btn-primary" onclick="window.saveRbacMatrix()">
                    ${icons.check} Save Permissions Matrix
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <!-- Visual Permissions Matrix -->
            <div class="settings-group" style="padding: 24px; margin-bottom: 24px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
                    Role-Based Access Control (RBAC) Matrix
                </div>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                    Control module accessibility per organizational role. Changes apply across all branch terminals upon synchronization.
                </p>

                <div style="overflow-x: auto;">
                    <table class="corp-table">
                        <thead>
                            <tr>
                                <th>Organizational Role</th>
                                ${modules.map(m => `<th style="text-align: center;">${m.label}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${roles.map(role => `
                                <tr>
                                    <td style="font-weight: 600; color: #0f172a;">${role}</td>
                                    ${modules.map(m => {
                                        const allowed = matrix[role] ? matrix[role][m.key] : false;
                                        return `
                                            <td style="text-align: center;">
                                                <input type="checkbox" style="width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;" 
                                                       ${allowed ? 'checked' : ''} 
                                                       ${role === 'Top Management' ? 'disabled' : ''}
                                                       onchange="window.updateMatrixCell('${role}', '${m.key}', this.checked)">
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Staff Credentials & Terminal Binding Table -->
            <div class="settings-group" style="padding: 0; overflow: hidden;">
                <div style="padding: 20px 24px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 15px; font-weight: 700; color: #0f172a;">
                            Authorized Staff & Terminal Device Bindings
                        </div>
                        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                            Reset hardware terminal locks, lock credentials, or delete staff records.
                        </p>
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-muted); background: #f1f5f9; padding: 4px 10px; border-radius: 9999px;">
                        ${employees.length} Personnel Accounts
                    </span>
                </div>

                <table class="corp-table">
                    <thead>
                        <tr>
                            <th style="width: 48px;"></th>
                            <th>Employee ID</th>
                            <th>Full Name</th>
                            <th>Role</th>
                            <th>Branch Location</th>
                            <th>Terminal Binding</th>
                            <th>Account Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${employees.length === 0 ? `
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">
                                    No staff accounts configured. Click "Add Staff Member" to register personnel.
                                </td>
                            </tr>
                        ` : employees.map(emp => {
                            const empId = emp.id || emp.empId;
                            const isLocked = emp.isLocked || emp.is_locked;
                            const boundDeviceId = emp.allowedDeviceId || emp.allowed_device_id;
                            return `
                                <tr>
                                    <td>
                                        <div class="monogram-badge badge-purple" style="font-size: 11px;">
                                            ${(emp.name || 'EM').substring(0, 2).toUpperCase()}
                                        </div>
                                    </td>
                                    <td style="font-family: monospace; font-weight: 600;">${empId}</td>
                                    <td style="font-weight: 600; color: #0f172a;">${emp.name}</td>
                                    <td><span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${emp.role}</span></td>
                                    <td style="color: #64748b;">${emp.assignedUnitId || emp.assigned_unit_id || 'All Locations'}</td>
                                    <td>
                                        ${boundDeviceId ? `
                                            <span class="status-badge badge-blue">
                                                ${icons.lock} Bound: ${boundDeviceId.substring(0, 10)}...
                                            </span>
                                        ` : `
                                            <span class="status-badge" style="background: #f1f5f9; color: #64748b;">
                                                ${icons.unlock} Unbound
                                            </span>
                                        `}
                                    </td>
                                    <td>
                                        <span class="status-badge ${isLocked ? 'badge-danger' : 'badge-active'}">
                                            ${isLocked ? 'Locked' : 'Active'}
                                        </span>
                                    </td>
                                    <td style="text-align: right; white-space: nowrap;">
                                        ${boundDeviceId ? `
                                            <button class="btn btn-sm btn-secondary" onclick="window.resetStaffDevice('${empId}')" title="Unbind hardware device">
                                                Reset Device
                                            </button>
                                        ` : ''}
                                        <button class="btn btn-sm btn-secondary" style="color: ${isLocked ? '#16a34a' : 'var(--text-secondary)'}; margin-left: 4px;" onclick="window.toggleStaffLock('${empId}', ${!isLocked})">
                                            ${isLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                        <button class="btn btn-sm btn-secondary" style="color: var(--danger); border-color: var(--danger-border); background: var(--danger-bg); margin-left: 6px;" onclick="window.deleteStaffUser('${empId}', '${emp.name ? emp.name.replace(/'/g, "\\'") : empId}')" title="Delete staff account">
                                            ${icons.trash} Delete
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

// ==========================================
// CONTROLLERS
// ==========================================
window.updateMatrixCell = (role, modKey, val) => {
    window.rbacMatrix = window.rbacMatrix || {};
    window.rbacMatrix[role] = window.rbacMatrix[role] || {};
    window.rbacMatrix[role][modKey] = val;
};

window.saveRbacMatrix = async () => {
    showLoading('Saving permissions matrix...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch('/api/business/rbac', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(window.rbacMatrix)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showSuccessOverlay('Access permissions matrix saved successfully');
        } else {
            showToast(data.detail || 'Failed to save permissions matrix', 'error');
        }
    } catch (e) {
        showToast('Communication error during save', 'error');
    } finally {
        hideLoading();
    }
};

window.deleteStaffUser = async (empId, empName) => {
    if (!confirm(`Are you sure you want to delete staff account "${empName || empId}"?\n\nThis will remove their login access and terminal binding permanently.`)) {
        return;
    }

    showLoading(`Deleting staff account ${empId}...`);
    try {
        const db = getDB();
        const emp = (db.employees || []).find(e => (e.id === empId || e.empId === empId));
        const unitId = emp ? (emp.assignedUnitId || emp.assigned_unit_id || 'unit-1') : 'unit-1';

        // 1. Delete from PostgreSQL backend via API
        try {
            await SecureAPIConnector.delete('employees', empId, unitId);
        } catch (apiErr) {
            console.warn('API delete warning:', apiErr);
        }

        // 2. Remove from Local Database state
        db.employees = (db.employees || []).filter(e => (e.id !== empId && e.empId !== empId));
        await saveDB(db);

        logAudit('ADMIN', unitId, 'EMPLOYEE_DELETE', `Deleted staff account ${empName} (${empId})`);
        showSuccessOverlay(`Staff member "${empName || empId}" deleted successfully`);
    } catch (e) {
        console.error('Delete employee error:', e);
        showToast('Failed to delete staff account', 'error');
    } finally {
        hideLoading();
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    }
};

window.resetStaffDevice = async (empId) => {
    if (!confirm('Unbind this hardware device? The employee can bind their new terminal on next login.')) return;
    showLoading('Resetting device binding...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch('/api/business/employee/device-reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ empId })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Device binding reset successfully', 'success');
            const db = getDB();
            if (db.employees) {
                const emp = db.employees.find(e => (e.id === empId || e.empId === empId));
                if (emp) { emp.allowedDeviceId = null; emp.allowed_device_id = null; }
            }
            await saveDB(db);
            if (window.renderTabContentDOM) window.renderTabContentDOM();
        } else {
            showToast(data.detail || 'Failed to reset device', 'error');
        }
    } catch (e) {
        showToast('Communication error', 'error');
    } finally {
        hideLoading();
    }
};

window.toggleStaffLock = async (empId, newLockStatus) => {
    showLoading(`${newLockStatus ? 'Locking' : 'Unlocking'} user account...`);
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch('/api/business/employee/lock-toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ empId, isLocked: newLockStatus })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`User account ${newLockStatus ? 'locked' : 'unlocked'} successfully`, 'success');
            const db = getDB();
            if (db.employees) {
                const emp = db.employees.find(e => (e.id === empId || e.empId === empId));
                if (emp) { emp.isLocked = newLockStatus; emp.is_locked = newLockStatus; }
            }
            await saveDB(db);
            if (window.renderTabContentDOM) window.renderTabContentDOM();
        } else {
            showToast(data.detail || 'Failed to update account status', 'error');
        }
    } catch (e) {
        showToast('Communication error', 'error');
    } finally {
        hideLoading();
    }
};

window.openAddStaffModal = () => {
    const db = getDB();
    const units = db.units || [];
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        modalEl.onclick = (e) => { if (e.target === modalEl) window.closeModal(); };
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="modal-card" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Add Staff Member</h3>
                <button class="close-btn" onclick="window.closeModal()" title="Close dialog">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label class="form-label">Full Name *</label>
                    <input type="text" id="staff-modal-name" class="form-input" placeholder="e.g. Ramesh Kumar">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                    <div class="form-group">
                        <label class="form-label">Role *</label>
                        <select id="staff-modal-role" class="form-select">
                            <option value="Cashier">Cashier</option>
                            <option value="Branch Manager">Branch Manager</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Kitchen Staff">Kitchen Staff</option>
                            <option value="Top Management">Top Management</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Assigned Location *</label>
                        <select id="staff-modal-unit" class="form-select">
                            ${units.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                    <div class="form-group">
                        <label class="form-label">Employee ID *</label>
                        <input type="text" id="staff-modal-id" class="form-input" value="sn-${Date.now().toString().slice(-4)}" placeholder="e.g. sn-101">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Login Password / PIN *</label>
                        <input type="password" id="staff-modal-pass" class="form-input" value="1234" placeholder="••••">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveNewStaff()">Create Account</button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};

window.saveNewStaff = async () => {
    const name = document.getElementById('staff-modal-name').value.trim();
    const role = document.getElementById('staff-modal-role').value;
    const unitId = document.getElementById('staff-modal-unit').value;
    const empId = document.getElementById('staff-modal-id').value.trim();
    const pass = document.getElementById('staff-modal-pass').value.trim();

    if (!name || !empId || !pass) {
        showToast('Please enter full name, employee ID, and password', 'error');
        return;
    }

    showLoading('Creating staff account...');
    try {
        const db = getDB();
        db.employees = db.employees || [];
        const newEmp = {
            id: empId,
            empId,
            name,
            role,
            assignedUnitId: unitId,
            assigned_unit_id: unitId,
            password: pass,
            isLocked: false,
            is_locked: false,
            allowedDeviceId: null,
            allowed_device_id: null
        };
        db.employees.push(newEmp);
        await SecureAPIConnector.upsert('employees', unitId, [newEmp]);
        await saveDB(db);
        window.closeModal();
        showSuccessOverlay(`Staff member "${name}" registered successfully`);
    } catch (e) {
        showToast('Failed to save staff member', 'error');
    } finally {
        hideLoading();
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    }
};
