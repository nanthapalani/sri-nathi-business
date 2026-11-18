import { getDB, saveDB, SecureAPIConnector, logAudit } from '/shared/db.js?v=14';
import { getIcons, formatINR, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';
import { openImportCatalogModal } from './import_modal.js';

export const renderPosTab = () => {
    const db = getDB();
    const icons = getIcons();
    const menu = db.menu || [];
    
    // Sort by name
    const sortedMenu = [...menu].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Category pills logic
    const categories = ['All', 'Tiffins', 'Meals', 'Beverages', 'Snacks', 'Desserts'];
    const activeCategory = window.posCategoryFilter || 'All';
    
    const categoryPillsHTML = categories.map(cat => `
        <button class="pill-btn ${activeCategory === cat ? 'active' : ''}" 
                onclick="window.posCategoryFilter='${cat}'; window.renderTabContentDOM();">
            ${cat}
        </button>
    `).join('');

    // Filtering logic
    const filteredMenu = sortedMenu.filter(m => {
        if (window.searchQuery) {
            const q = window.searchQuery.toLowerCase();
            const matchesSearch = (m.name && m.name.toLowerCase().includes(q)) || 
                                 (m.itemCode && m.itemCode.toLowerCase().includes(q)) ||
                                 (m.item_number && m.item_number.toLowerCase().includes(q));
            if (!matchesSearch) return false;
        }
        if (activeCategory !== 'All') {
            if (m.category !== activeCategory) return false;
        }
        return true;
    });

    return `
        <header class="settings-header-area">
            <div class="settings-header-title">
                <h2>Product Catalog & Pricing Management</h2>
                <p>Manage product items, category pricing, tax slabs, and sales channel distribution.</p>
            </div>
            <div class="settings-header-actions">
                <button class="btn btn-secondary" onclick="window.exportMenuCSV()" title="Export Catalog to CSV">
                    ${icons.download} Export CSV
                </button>
                <button class="btn btn-secondary" onclick="window.openImportCatalogModal()" title="Import Excel/CSV Catalog">
                    ${icons.upload || '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'} Import Catalog (Excel/CSV)
                </button>
                <button class="btn btn-secondary" onclick="window.openBulkPriceModal()" title="Adjust category pricing">
                    ${icons.dollar} Price Adjustment
                </button>
                <button class="btn btn-primary" onclick="window.openModal('menu', 'add')">
                    ${icons.plus} Add Product
                </button>
            </div>
        </header>

        <div class="settings-content-area">
            <!-- Category Filter Bar & Search -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; gap: 6px; overflow-x: auto;">
                    ${categoryPillsHTML}
                </div>
                <div style="width: 260px;">
                    <input type="text" class="form-input" placeholder="Search product or code..." value="${window.searchQuery || ''}" oninput="window.setSearchQuery(this.value)">
                </div>
            </div>

            <!-- Summary KPI Strip -->
            <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                <div style="padding: 8px 14px; background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;">
                    Total Catalog: <strong>${menu.length} items</strong>
                </div>
                <div style="padding: 8px 14px; background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;">
                    Point of Sale Active: <strong style="color: #16a34a;">${menu.filter(m => m.active !== false).length} items</strong>
                </div>
                <div style="padding: 8px 14px; background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;">
                    Online Partner 1: <strong>${menu.filter(m => m.isAvailableSwiggy !== false && m.is_available_swiggy !== false).length} active</strong>
                </div>
                <div style="padding: 8px 14px; background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;">
                    Online Partner 2: <strong>${menu.filter(m => m.isAvailableZomato !== false && m.is_available_zomato !== false).length} active</strong>
                </div>
            </div>

            <!-- Corporate Data Table -->
            <div class="settings-group" style="padding: 0; overflow: hidden;">
                <table class="corp-table">
                    <thead>
                        <tr>
                            <th style="width: 48px;"></th>
                            <th style="width: 100px;">Item Code</th>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Unit Price</th>
                            <th>GST Slab</th>
                            <th style="text-align: center;">POS Status</th>
                            <th style="text-align: center;">Partner 1</th>
                            <th style="text-align: center;">Partner 2</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredMenu.length === 0 ? `
                            <tr><td colspan="10" style="text-align:center; padding: 48px; color: var(--text-muted);">No catalog items match the search criteria.</td></tr>
                        ` : filteredMenu.map(m => {
                            const isSwiggy = m.isAvailableSwiggy !== false && m.is_available_swiggy !== false;
                            const isZomato = m.isAvailableZomato !== false && m.is_available_zomato !== false;
                            const isActive = m.active !== false;
                            const code = m.itemCode || m.item_number || m.id || '-';
                            return `
                                <tr>
                                    <td>
                                        <div class="monogram-badge badge-blue" style="font-size: 11px;">
                                            ${(m.name || 'IT').substring(0, 2).toUpperCase()}
                                        </div>
                                    </td>
                                    <td style="font-weight: 600; color: var(--text-main); font-family: monospace;">${code}</td>
                                    <td style="font-weight: 600; color: #0f172a;">${m.name || ''}</td>
                                    <td><span style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${m.category || 'General'}</span></td>
                                    <td style="font-weight: 700; color: #0f172a;">${formatINR(m.price || 0)}</td>
                                    <td style="color: #64748b;">${m.gstRate || m.gst_rate || 5}%</td>
                                    
                                    <!-- POS Active Switch -->
                                    <td style="text-align: center;">
                                        <label class="toggle-switch">
                                            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="window.toggleMenuChannel('${m.id}', 'active', this.checked)">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </td>
                                    
                                    <!-- Partner 1 Switch -->
                                    <td style="text-align: center;">
                                        <label class="toggle-switch">
                                            <input type="checkbox" ${isSwiggy ? 'checked' : ''} onchange="window.toggleMenuChannel('${m.id}', 'is_available_swiggy', this.checked)">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </td>
                                    
                                    <!-- Partner 2 Switch -->
                                    <td style="text-align: center;">
                                        <label class="toggle-switch">
                                            <input type="checkbox" ${isZomato ? 'checked' : ''} onchange="window.toggleMenuChannel('${m.id}', 'is_available_zomato', this.checked)">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </td>

                                    <td style="text-align: right; white-space: nowrap;">
                                        <button class="btn btn-sm btn-secondary" onclick='window.openModal("menu", "edit", ${JSON.stringify(m)})'>Edit</button>
                                        <button class="btn btn-sm btn-secondary" style="color: var(--danger); margin-left: 4px;" onclick="window.deleteMenuItem('${m.id}')" title="Delete Product">
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
window.toggleMenuChannel = async (itemId, channel, status) => {
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
    try {
        const res = await fetch('/api/business/menu/channel-toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: itemId, channel, status, unitId: 'unit-1' })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Availability status updated', 'success');
            const db = getDB();
            if (db.menu) {
                const it = db.menu.find(m => m.id === itemId);
                if (it) {
                    it[channel] = status;
                    if (channel === 'is_available_swiggy') it.isAvailableSwiggy = status;
                    if (channel === 'is_available_zomato') it.isAvailableZomato = status;
                }
            }
        } else {
            showToast(data.detail || 'Failed to update channel status', 'error');
        }
    } catch (e) {
        showToast('Network communication error', 'error');
    }
};

window.deleteMenuItem = async (itemId) => {
    if (!confirm('Are you sure you want to remove this product from the catalog?')) return;
    const db = getDB();
    if (db.menu) {
        db.menu = db.menu.filter(m => m.id !== itemId);
        showLoading('Removing product from database...');
        try {
            await SecureAPIConnector.delete('menu', itemId, 'unit-1');
            await saveDB(db);
            showToast('Product removed successfully', 'success');
        } catch (e) {
            showToast('Failed to remove product', 'error');
        } finally {
            hideLoading();
            if (window.renderTabContentDOM) window.renderTabContentDOM();
        }
        const activeUserId = window.state?.currentUser?.id || 'SYSTEM';
        const activeUnitId = window.state?.activeUnitId || 'unit-1';
        if (logAudit) logAudit(activeUserId, activeUnitId, 'DELETE_MENU_ITEM', `Deleted menu item ${itemId}`);
    }
};

window.exportMenuCSV = () => {
    const db = getDB();
    const menu = db.menu || [];
    if (!menu.length) {
        showToast('No products in catalog to export', 'error');
        return;
    }
    
    const headers = ['Item Code', 'Product Name', 'Category', 'Unit Price', 'GST Slab (%)', 'POS Status', 'Partner 1 Status', 'Partner 2 Status'];
    const rows = menu.map(m => [
        `"${String(m.itemCode || m.item_number || m.id || '-').replace(/"/g, '""')}"`,
        `"${String(m.name || '').replace(/"/g, '""')}"`,
        `"${String(m.category || 'General').replace(/"/g, '""')}"`,
        m.price || 0,
        m.gstRate || m.gst_rate || 5,
        m.active !== false ? 'Active' : 'Inactive',
        m.isAvailableSwiggy !== false && m.is_available_swiggy !== false ? 'Active' : 'Inactive',
        m.isAvailableZomato !== false && m.is_available_zomato !== false ? 'Active' : 'Inactive'
    ]);
    
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalog_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Catalog exported to CSV', 'success');
};

window.openBulkPriceModal = () => {
    const db = getDB();
    const categories = ['All', ...new Set((db.menu || []).map(m => m.category).filter(Boolean))];
    
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        document.body.appendChild(modalEl);
    }
    
    modalEl.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>Bulk Price Adjustment</h3>
                <button class="close-btn" onclick="window.closeModal()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
                    Adjust unit prices across a specific category or the entire product catalog. Changes will be saved directly to the database.
                </p>
                <div class="form-group" style="margin-bottom: 14px;">
                    <label class="form-label">Category</label>
                    <select id="bulk-price-category" class="form-select">
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 12px; margin-bottom: 14px;">
                    <div class="form-group" style="flex:1;">
                        <label class="form-label">Percentage Adjustment (%)</label>
                        <input type="number" id="bulk-price-percent" class="form-input" placeholder="e.g. 5 or -5" step="0.5">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label class="form-label">Or Fixed Value (₹)</label>
                        <input type="number" id="bulk-price-fixed" class="form-input" placeholder="e.g. 10 or -10" step="1">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 24px;">
                    <label class="form-label">Price Rounding Method</label>
                    <select id="bulk-price-round" class="form-select">
                        <option value="1">Round to nearest ₹1.00</option>
                        <option value="5">Round to nearest ₹5.00</option>
                        <option value="10">Round to nearest ₹10.00</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.executeBulkPriceUpdate()">Apply Adjustments</button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};

window.executeBulkPriceUpdate = async () => {
    const category = document.getElementById('bulk-price-category').value;
    const percentage = parseFloat(document.getElementById('bulk-price-percent').value || 0);
    const fixedAmount = parseFloat(document.getElementById('bulk-price-fixed').value || 0);
    const roundToNearest = parseInt(document.getElementById('bulk-price-round').value || 1);
    
    if (percentage === 0 && fixedAmount === 0) {
        showToast('Please enter an adjustment percentage or fixed value', 'error');
        return;
    }
    
    showLoading('Applying price adjustments to database...');
    const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
    
    try {
        const res = await fetch('/api/business/menu/bulk-price-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ category, percentage, fixedAmount, roundToNearest })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            window.closeModal();
            showSuccessOverlay(data.message || 'Prices adjusted successfully.');
            if (window.syncBackend) await window.syncBackend();
            setTimeout(() => {
                if (window.renderTabContentDOM) window.renderTabContentDOM();
            }, 500);
        } else {
            showToast(data.detail || 'Failed to adjust prices', 'error');
        }
    } catch (e) {
        showToast('Communication error during price update', 'error');
    } finally {
        hideLoading();
    }
};

window.exportMenuCSV = () => {
    const db = getDB();
    const menu = db.menu || [];
    if (!menu.length) {
        showToast('No catalog items to export', 'error');
        return;
    }
    
    const headers = ['Item Code', 'Product Name', 'Category', 'Price', 'GST Rate', 'POS Status', 'Partner 1 Status', 'Partner 2 Status'];
    const rows = menu.map(m => [
        `"${m.itemCode || m.item_number || m.id || ''}"`,
        `"${(m.name || '').replace(/"/g, '""')}"`,
        `"${m.category || 'General'}"`,
        m.price || 0,
        m.gstRate || m.gst_rate || 5,
        m.active !== false ? 'Active' : 'Inactive',
        m.isAvailableSwiggy !== false ? 'Active' : 'Inactive',
        m.isAvailableZomato !== false ? 'Active' : 'Inactive'
    ]);
    
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sri_nathi_catalog_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Catalog exported to CSV', 'success');
};
