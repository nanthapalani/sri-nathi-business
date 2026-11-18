import { getIcons, showToast, showLoading, hideLoading, formatDateTime } from '../utils.js';

export const renderDataStudioTab = () => {
    const icons = getIcons();
    
    // Supported enterprise collections
    const tables = [
        { key: 'invoices', label: 'Invoices & Sales', schema: 'public' },
        { key: 'catering_orders', label: 'Catering Orders', schema: 'operations' },
        { key: 'employees', label: 'Staff & Personnel', schema: 'hrs' },
        { key: 'customers', label: 'Customer Directory', schema: 'customer' },
        { key: 'inventory', label: 'Inventory Items', schema: 'operations' },
        { key: 'vendors', label: 'Suppliers & Vendors', schema: 'operations' },
        { key: 'utility_bills', label: 'Operating Expenses', schema: 'finance' },
        { key: 'units', label: 'Business Locations', schema: 'public' },
        { key: 'audit_logs', label: 'System Audit Trail', schema: 'public' }
    ];

    const activeTableKey = window.activeStudioTable || 'invoices';
    const activeTable = tables.find(t => t.key === activeTableKey) || tables[0];
    const data = window.studioTableData || [];
    const columns = window.studioTableColumns || [];

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>Master Data Explorer</h2>
                <p>Universal table inspector, live record editor, and CSV report generator for all enterprise collections.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-secondary" onclick="window.exportStudioTableCSV()">
                    ${icons.download} Export Table CSV
                </button>
                <button class="btn btn-primary" onclick="window.fetchStudioTable('${activeTableKey}')">
                    ${icons.refresh} Refresh Data
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <!-- Table Selector Pills -->
            <div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 20px; padding-bottom: 4px;">
                ${tables.map(t => `
                    <button class="pill-btn ${activeTableKey === t.key ? 'active' : ''}" 
                            onclick="window.selectStudioTable('${t.key}')">
                        ${t.label}
                    </button>
                `).join('')}
            </div>

            <!-- Table Summary & Search Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                <div style="font-size: 13.5px; color: var(--text-muted);">
                    Viewing <strong>${data.length} records</strong> in <code style="color: var(--accent);">${activeTable.schema}.${activeTable.key}</code>
                </div>
                <div style="width: 260px;">
                    <input type="text" class="form-input" placeholder="Search table rows..." oninput="window.filterStudioTable(this.value)">
                </div>
            </div>

            <!-- Data Table Container -->
            <div class="settings-group" style="padding: 0; overflow-x: auto;">
                <table class="corp-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                            <th style="text-align: right; width: 120px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="studio-table-body">
                        ${data.length === 0 ? `
                            <tr>
                                <td colspan="${columns.length + 1}" style="text-align: center; padding: 48px; color: var(--text-muted);">
                                    No records found in this table or loading in progress.
                                </td>
                            </tr>
                        ` : data.slice(0, 50).map(row => {
                            const isSoftDeleted = row.is_deleted === true || row.status === 'DELETED';
                            return `
                                <tr style="${isSoftDeleted ? 'opacity: 0.5; background: #fff1f2;' : ''}">
                                    ${columns.map(col => {
                                        let val = row[col];
                                        if (val === null || val === undefined) val = '<span style="color:#cbd5e1;">null</span>';
                                        else if (typeof val === 'object') val = JSON.stringify(val);
                                        else if (typeof val === 'string' && val.length > 40) val = val.substring(0, 40) + '...';
                                        return `<td style="font-family: monospace; font-size: 12.5px;">${val}</td>`;
                                    }).join('')}
                                    <td style="text-align: right; white-space: nowrap;">
                                        <button class="btn btn-sm btn-secondary" onclick='window.openStudioEditModal(${JSON.stringify(row)})'>
                                            Edit
                                        </button>
                                        <button class="btn btn-sm btn-secondary" style="color: var(--danger); margin-left: 4px;" onclick="window.deleteStudioRow('${row.id}')" title="Delete Record">
                                            ${icons.trash}
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
window.selectStudioTable = (tableKey) => {
    window.activeStudioTable = tableKey;
    window.fetchStudioTable(tableKey);
};

window.fetchStudioTable = async (tableKey = 'invoices') => {
    showLoading(`Loading ${tableKey} data from database...`);
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');

    try {
        const res = await fetch(`/api/business/tables/${tableKey}?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (res.ok && result.status === 'success') {
            window.studioTableData = result.rows || [];
            window.studioTableColumns = result.columns || [];
        } else {
            showToast(result.detail || 'Failed to load table data', 'error');
        }
    } catch (e) {
        showToast('Communication error loading data', 'error');
    } finally {
        hideLoading();
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    }
};

window.openStudioEditModal = (row) => {
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        document.body.appendChild(modalEl);
    }

    const tableKey = window.activeStudioTable || 'invoices';
    const jsonStr = JSON.stringify(row, null, 2);

    modalEl.innerHTML = `
        <div class="modal-card" style="max-width: 620px;">
            <div class="modal-header">
                <h3>Edit Record [${row.id || 'N/A'}]</h3>
                <button class="close-btn" onclick="window.closeModal()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                    Modify attributes for master ledger record <code>${tableKey}</code>. Changes synchronize across all operational units.
                </p>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label class="form-label">Record JSON Structure</label>
                    <textarea id="studio-json-editor" class="form-input" rows="12" style="font-family: monospace; font-size: 12px;">${jsonStr}</textarea>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveStudioRow('${row.id}')">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};

window.saveStudioRow = async (rowId) => {
    const rawJSON = document.getElementById('studio-json-editor').value;
    let parsed;
    try {
        parsed = JSON.parse(rawJSON);
    } catch (e) {
        showToast('Invalid JSON syntax', 'error');
        return;
    }

    showLoading('Updating database record...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
    const tableKey = window.activeStudioTable || 'invoices';

    try {
        const res = await fetch('/api/business/row', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tableKey, rowId, data: parsed, unitId: 'unit-1' })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            window.closeModal();
            showToast('Record saved successfully', 'success');
            window.fetchStudioTable(tableKey);
        } else {
            showToast(data.detail || 'Failed to update record', 'error');
        }
    } catch (e) {
        showToast('Communication error during record save', 'error');
    } finally {
        hideLoading();
    }
};

window.deleteStudioRow = async (rowId) => {
    if (!confirm(`Are you sure you want to delete row ${rowId}?`)) return;
    showLoading('Deleting database record...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
    const tableKey = window.activeStudioTable || 'invoices';

    try {
        const res = await fetch(`/api/business/row/${tableKey}/${rowId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Record deleted successfully', 'success');
            window.fetchStudioTable(tableKey);
        } else {
            showToast(data.detail || 'Failed to delete record', 'error');
        }
    } catch (e) {
        showToast('Communication error during delete', 'error');
    } finally {
        hideLoading();
    }
};

window.exportStudioTableCSV = () => {
    const data = window.studioTableData || [];
    const cols = window.studioTableColumns || [];
    const tableKey = window.activeStudioTable || 'table';

    if (!data.length) {
        showToast('No records to export', 'error');
        return;
    }

    const headers = cols;
    const rows = data.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${tableKey}_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Table exported to CSV', 'success');
};
