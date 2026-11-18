import { getDB, SecureAPIConnector } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading } from '../utils.js';

export const renderArchiveTab = () => {
    // Run initialization async in background
    setTimeout(window.loadArchiveData, 100);

    return `
        <div class="content-wrapper" style="padding: 24px; max-width: 1200px; margin: 0 auto;">
            <div class="page-header-block" style="margin-bottom: 24px;">
                <div class="page-title-text">
                    <h1>Data Archive / Recycle Bin</h1>
                    <p>View soft-deleted records here. You can either restore them or permanently hard-delete them.</p>
                </div>
            </div>

            <div style="display: flex; gap: 16px; margin-bottom: 24px; align-items: center; background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <label style="font-weight: 600; font-size: 14px; color: #1e293b;">Select Module:</label>
                <select id="archive-module-select" onchange="window.loadArchiveData()" style="padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; min-width: 250px; background: #f8fafc; cursor: pointer; outline: none;">
                    <option value="items">Menu Items & Products</option>
                    <option value="infrastructure">Infrastructure & Devices</option>
                    <option value="employees">Employees & Staff</option>
                    <option value="branches">Branches & Units</option>
                    <option value="categories">Categories</option>
                </select>
                <button onclick="window.loadArchiveData()" class="btn btn-secondary" style="margin-left: auto;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 2v6h6"/></svg>
                    Refresh Data
                </button>
            </div>

            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <tr>
                            <th style="padding: 16px; font-weight: 600; color: #475569;">Record ID</th>
                            <th style="padding: 16px; font-weight: 600; color: #475569;">Name / Title</th>
                            <th style="padding: 16px; font-weight: 600; color: #475569;">Deleted At</th>
                            <th style="padding: 16px; font-weight: 600; color: #475569; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="archive-table-body">
                        <tr>
                            <td colspan="4" style="padding: 40px; text-align: center; color: #94a3b8; font-style: italic;">
                                Loading archived records...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

window.loadArchiveData = async () => {
    const select = document.getElementById('archive-module-select');
    const tbody = document.getElementById('archive-table-body');
    if (!select || !tbody) return;

    const key = select.value;
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 40px; text-align: center; color: #94a3b8;">Loading archive...</td></tr>';
    
    try {
        const data = await SecureAPIConnector.fetchArchivedData(key, 'unit-1');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 40px; text-align: center; color: #94a3b8; font-weight: 500;">No soft-deleted records found for this module.</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(item => {
            const id = item.id || item.code || '-';
            const name = item.name || item.title || item.ip_address || item.mac_address || 'Unnamed Record';
            const deletedAt = item.deleted_at ? new Date(item.deleted_at).toLocaleString() : 'Unknown Time';
            
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 16px; font-family: monospace; color: #64748b; font-weight: 600;">${id}</td>
                    <td style="padding: 16px; font-weight: 500; color: #0f172a;">${name}</td>
                    <td style="padding: 16px; color: #ef4444; font-size: 13px; font-weight: 500;">${deletedAt}</td>
                    <td style="padding: 16px; text-align: right;">
                        <button onclick="window.restoreArchiveRecord('${key}', '${id}')" style="padding: 6px 14px; background: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin-right: 8px; transition: all 0.2s;">
                            Restore
                        </button>
                        <button onclick="window.hardDeleteArchiveRecord('${key}', '${id}')" style="padding: 6px 14px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
                            Hard Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 40px; text-align: center; color: #ef4444; font-weight: 600;">Error loading archived data.</td></tr>';
    }
};

window.restoreArchiveRecord = async (key, id) => {
    if (!confirm('Are you sure you want to restore this record? It will instantly reappear in the active system.')) return;
    showLoading('Restoring record...');
    try {
        const res = await SecureAPIConnector.restoreRecord(key, id, 'unit-1');
        if (res.ok) {
            showToast('Record restored successfully.', 'success');
            window.loadArchiveData();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to restore record', 'error');
        }
    } catch (e) {
        showToast('Error restoring record', 'error');
    } finally {
        hideLoading();
    }
};

window.hardDeleteArchiveRecord = async (key, id) => {
    if (!confirm('WARNING: Hard deleting this record is completely irreversible! It will be permanently removed from the database.\\n\\nAre you absolutely sure you want to proceed?')) return;
    showLoading('Permanently deleting record...');
    try {
        const res = await SecureAPIConnector.hardDelete(key, id, 'unit-1');
        if (res.ok) {
            showToast('Record permanently deleted from database.', 'success');
            window.loadArchiveData();
        } else {
            const err = await res.json();
            showToast(err.detail || 'Failed to hard delete record', 'error');
        }
    } catch (e) {
        showToast('Error deleting record', 'error');
    } finally {
        hideLoading();
    }
};
