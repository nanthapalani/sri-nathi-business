import { getDB } from '/shared/db.js?v=14';
import { getIcons, formatDateTime, showToast, showLoading, hideLoading } from '../utils.js';

export const renderActivityTab = () => {
    const db = getDB();
    const icons = getIcons();
    const logs = db.audit_logs || db.auditLogs || [];

    // Sort descending by timestamp
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>System Audit & Activity Trail</h2>
                <p>Immutable cryptographic transaction records, user administrative actions, and configuration changes.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-secondary" onclick="window.exportAuditLogsCSV()">
                    ${icons.download} Export CSV
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <div class="settings-group" style="padding: 0; overflow: hidden;">
                <table class="corp-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>User ID</th>
                            <th>Branch Location</th>
                            <th>Action Type</th>
                            <th>Event Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedLogs.length === 0 ? `
                            <tr><td colspan="5" style="text-align: center; padding: 48px; color: var(--text-muted);">No activity logs recorded.</td></tr>
                        ` : sortedLogs.slice(0, 100).map(log => `
                            <tr>
                                <td style="color: var(--text-muted); font-size: 12.5px; white-space: nowrap;">${formatDateTime(log.timestamp || log.created_at)}</td>
                                <td style="font-family: monospace; font-weight: 600;">${log.empId || log.emp_id || log.userId || 'SYSTEM'}</td>
                                <td style="color: #64748b;">${log.unitId || log.unit_id || 'All'}</td>
                                <td>
                                    <span class="status-badge" style="background: #f1f5f9; color: #334155; font-family: monospace;">
                                        ${log.action || log.event_type || 'UPDATE'}
                                    </span>
                                </td>
                                <td style="color: #334155;">${log.details || log.description || log.message || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

window.exportAuditLogsCSV = () => {
    const db = getDB();
    const logs = db.audit_logs || db.auditLogs || [];
    if (!logs.length) {
        showToast('No audit logs to export', 'error');
        return;
    }

    const headers = ['Timestamp', 'User ID', 'Branch Location', 'Action Type', 'Event Description'];
    const rows = logs.map(l => [
        `"${l.timestamp || l.created_at || ''}"`,
        `"${l.empId || l.emp_id || l.userId || 'SYSTEM'}"`,
        `"${l.unitId || l.unit_id || ''}"`,
        `"${l.action || l.event_type || ''}"`,
        `"${(l.details || l.description || l.message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sri_nathi_audit_trail_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit trail exported to CSV', 'success');
};
