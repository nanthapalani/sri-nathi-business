import { getDB } from '/shared/db.js?v=14';
import { formatINR, formatDateTime, getIcons } from '../utils.js';

export const renderStorageTab = () => {
    const db = getDB();
    const icons = getIcons();
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{"companyName":"Sri Nathi"}');
    const storage = window.systemStatus?.storage || { used_bytes: 0 };
        const usedGB = (storage.used_bytes / (1024*1024*1024)).toFixed(2);
        
        return `
            <header class="settings-header-area">
                <div class="settings-header-title">
                    <h2>Storage Monitor</h2>
                    <p>PostgreSQL Host Machine Analysis</p>
                </div>
            </header>
            <div class="settings-content-area">
                <div class="settings-group-title">Primary Host Storage (SQL Database)</div>
                <div class="settings-group" style="padding: 1.5rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:600; font-size:15px; color:var(--text-main);">
                        <span>${usedGB} GB Used</span>
                    </div>
                    <div class="storage-bar-wrapper">
                        <div class="storage-segment primary" style="width: 100%;"></div>
                    </div>
                    <div class="storage-legend">
                        <div class="legend-item"><div class="legend-dot primary" style="background:var(--accent);"></div> PostgreSQL Data (${usedGB} GB)</div>
                    </div>
                </div>
            </div>
        `;
};
