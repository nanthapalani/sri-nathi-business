import { getDB } from '/shared/db.js?v=14';
import { formatINR, formatDateTime, getIcons } from '../utils.js';

export const renderWalletTab = () => {
    let html = '';
    
};

window.fetchUPIHistory = async () => {
    try {
        const API_BASE = "";
        const res = await fetch(`${API_BASE}/api/webhooks/gpay/history`);
        const data = await res.json();
        return data.transactions || [];
    } catch (e) {
        return [];
    }
};

window.fetchUPIHistory = async () => {
    try {
        const API_BASE = "";
        const res = await fetch(`${API_BASE}/api/webhooks/gpay/history`);
        const data = await res.json();
        return data.transactions || [];
    } catch (e) {
        return [];
    }
};
