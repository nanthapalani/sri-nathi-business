import { getDB } from '/shared/db.js?v=14';
import { formatINR, formatDateTime, getIcons } from '../utils.js';

export const renderDigital_paymentsTab = () => {
    const db = getDB();
    const icons = getIcons();
    const settings = JSON.parse(localStorage.getItem('sri_nathi_settings') || '{"companyName":"Sri Nathi"}');
    // Need to fetch data if not loaded
            if (!window.upiHistoryLoaded) {
                window.fetchUPIHistory().then(data => {
                    window.upiHistoryLoaded = true;
                    window.upiHistoryData = data;
                    window.renderTabContentDOM();
                });
                return `
                    <header class="settings-header-area">
                        <div class="settings-header-title">
                            <h2>Digital Payments Ledger</h2>
                            <p>Real-time Google Pay / PhonePe transaction dashboard.</p>
                        </div>
                    </header>
                    <div class="settings-content-area" style="text-align:center; padding: 40px;">
                        <div class="spinner" style="border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; display: inline-block;"></div>
                        <p style="margin-top:16px; color:var(--text-muted);">Syncing from database...</p>
                    </div>
                `;
            }
            
            const history = window.upiHistoryData || [];
            
            return `
                <header class="settings-header-area">
                    <div class="settings-header-title">
                        <h2>Digital Payments Ledger</h2>
                        <p>Real-time Google Pay / PhonePe transaction dashboard.</p>
                    </div>
                    <button class="btn btn-primary" onclick="window.upiHistoryLoaded = false; window.renderTabContentDOM();"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Refresh Sync</button>
                </header>
                <div class="settings-content-area">
                    <div class="settings-group" style="background:white; padding: 0;">
                        ${history.length === 0 ? `
                            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                                No recent UPI transactions found.
                            </div>
                        ` : history.map(txn => {
                            const date = new Date(txn.time);
                            const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                            const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                            
                            return `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px 20px; border-bottom: 1px solid #f1f5f9;">
                                <div style="display:flex; gap: 16px; align-items:center;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items:center; justify-content:center; font-weight:700;">
                                        ${txn.payer.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style="font-weight: 600; color: #0f172a; font-size: 15px;">${txn.payer}</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">TXN: ${txn.id} • ${dateStr}, ${timeStr}</div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; color: #22c55e; font-size: 16px;">+ ₹${txn.amount}</div>
                                    <div style="font-size: 11px; font-weight: 600; color: #16a34a; background: #dcfce7; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">SUCCESS</div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
};
