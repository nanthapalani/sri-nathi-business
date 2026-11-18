import { getDB, saveDB } from '/shared/db.js?v=14';
import { getIcons, showToast, showLoading, hideLoading, showSuccessOverlay } from '../utils.js';

export const openImportCatalogModal = () => {
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="modal-card" style="max-width: 680px;" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Bulk Catalog Import & Duplicate Detection</h3>
                <button class="close-btn" onclick="window.closeModal()" title="Close dialog">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <!-- Step 1: Actions & Video Tutorial Reference -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong style="font-size: 14px; color: #0f172a;">Standard File Format Template</strong>
                            <p style="font-size: 12px; color: #64748b; margin-top: 2px;">Ensure your file matches our required CSV/Excel columns.</p>
                        </div>
                        <a href="/public/templates/sri_nathi_catalog_template.csv" download="sri_nathi_catalog_template.csv" class="btn btn-sm btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Download Template CSV
                        </a>
                    </div>
                    
                    <button class="btn btn-sm btn-secondary" style="width: 100%; justify-content: center; background: #ffffff;" onclick="window.toggleImportVideoGuide()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                        <span id="import-video-btn-text" style="color: #2563eb; font-weight: 600;">Watch Tutorial & Visual Format Guide</span>
                    </button>

                    <!-- Embedded Instructional Guide Container -->
                    <div id="import-video-guide-box" style="display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
                        <div style="background: #0f172a; border-radius: 8px; padding: 20px; color: white; text-align: center;">
                            <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 8px;">VISUAL FORMAT INSTRUCTIONS</div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 11px; font-family: monospace; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
                                <div style="color: #4ade80;">Item Code*</div>
                                <div style="color: #4ade80;">Product Name*</div>
                                <div style="color: #4ade80;">Category</div>
                                <div style="color: #4ade80;">Unit Price (INR)*</div>
                            </div>
                            <p style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin: 0;">
                                • <strong>Item Code</strong> must contain numerical digits only (e.g. 1001, 1002).<br>
                                • <strong>Product Name</strong> must be unique.<br>
                                • Duplicates will be reported in the status screen upon upload completion.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Options & Upload Area -->
                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="margin-bottom: 8px; display: block;">Duplicate Handling Policy</label>
                    <div style="display: flex; gap: 16px; font-size: 13px;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="radio" name="duplicate-mode" value="skip" checked> Skip Duplicates & Report
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="radio" name="duplicate-mode" value="overwrite"> Overwrite Existing Prices
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Select Excel / CSV Catalog File *</label>
                    <input type="file" id="import-catalog-file-input" class="form-input" accept=".csv, .xlsx, .xls" style="padding: 10px; background: #f8fafc;">
                    <div style="font-size: 11.5px; color: #64748b; margin-top: 4px;">Supported file formats: <code>.csv</code>, <code>.xlsx</code>, <code>.xls</code></div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
                    <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.processCatalogFileImport()">
                        Upload & Ingest Catalog
                    </button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};
window.openImportCatalogModal = openImportCatalogModal;

window.toggleImportVideoGuide = () => {
    const box = document.getElementById('import-video-guide-box');
    const text = document.getElementById('import-video-btn-text');
    if (!box) return;
    if (box.style.display === 'none') {
        box.style.display = 'block';
        text.innerText = 'Hide Tutorial Guide';
    } else {
        box.style.display = 'none';
        text.innerText = 'Watch Tutorial & Visual Format Guide';
    }
};

window.processCatalogFileImport = async () => {
    const fileInput = document.getElementById('import-catalog-file-input');
    if (!fileInput || !fileInput.files.length) {
        showToast('Please select an Excel or CSV file to import', 'error');
        return;
    }

    const file = fileInput.files[0];
    const duplicateModes = document.getElementsByName('duplicate-mode');
    let overwrite = false;
    for (const r of duplicateModes) {
        if (r.checked && r.value === 'overwrite') overwrite = true;
    }

    showLoading('Parsing catalog file...');
    try {
        const text = await file.text();
        const rows = parseCSVContent(text);
        if (rows.length === 0) {
            showToast('Selected file contains no valid catalog rows', 'error');
            hideLoading();
            return;
        }

        const token = localStorage.getItem('sri_nathi_token') || localStorage.getItem('sri_nathi_jwt_token');
        showLoading(`Validating & Ingesting ${rows.length} product items...`);

        const res = await fetch('/api/business/menu/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: rows,
                overwriteDuplicates: overwrite,
                unitId: 'unit-1'
            })
        });

        const report = await res.json();
        hideLoading();

        if (res.ok && report.status === 'success') {
            window.closeModal();
            window.renderImportStatusModal(report);
            if (window.syncBackend) await window.syncBackend();
        } else {
            showToast(report.detail || 'Catalog import failed', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast(`Failed to process file: ${e.message}`, 'error');
    }
};

const parseCSVContent = (csvText) => {
    const lines = csvText.split(/\r\n|\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const items = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV splitter handling quotes
        const values = [];
        let insideQuote = false;
        let curVal = '';
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                values.push(curVal.trim().replace(/^"|"$/g, ''));
                curVal = '';
            } else {
                curVal += char;
            }
        }
        values.push(curVal.trim().replace(/^"|"$/g, ''));

        const rowObj = {};
        headers.forEach((h, idx) => {
            rowObj[h] = values[idx] !== undefined ? values[idx] : '';
        });

        // Map column variations
        const itemCode = rowObj['Item Code'] || rowObj['itemCode'] || rowObj['item_number'] || rowObj['Code'] || '';
        const name = rowObj['Product Name'] || rowObj['name'] || rowObj['Product'] || '';
        const category = rowObj['Category'] || rowObj['category'] || 'General';
        const price = rowObj['Unit Price (INR)'] || rowObj['Unit Price'] || rowObj['price'] || rowObj['Price'] || 0;
        const gstRate = rowObj['GST Rate (%)'] || rowObj['GST Rate'] || rowObj['gstRate'] || 5;

        if (name) {
            items.push({ itemCode, name, category, price, gstRate });
        }
    }
    return items;
};

window.renderImportStatusModal = (report) => {
    let modalEl = document.getElementById('business-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'business-modal';
        modalEl.className = 'modal-overlay';
        document.body.appendChild(modalEl);
    }

    const summary = report.summary || {};
    const duplicates = report.duplicates || [];
    const errors = report.errors || [];

    modalEl.innerHTML = `
        <div class="modal-card" style="max-width: 720px;" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Catalog Upload Status & Duplicate Report</h3>
                <button class="close-btn" onclick="window.closeModal(); if (window.renderTabContentDOM) window.renderTabContentDOM();">&times;</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <!-- Summary Metrics Strip -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${summary.totalProcessed || 0}</div>
                        <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Total Rows</div>
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 800; color: #16a34a;">${summary.successfullyAdded || 0}</div>
                        <div style="font-size: 11px; color: #15803d; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Items Added</div>
                    </div>
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 800; color: #d97706;">${summary.duplicatesSkipped || 0}</div>
                        <div style="font-size: 11px; color: #b45309; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Duplicates Skipped</div>
                    </div>
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 800; color: #dc2626;">${summary.invalidRows || 0}</div>
                        <div style="font-size: 11px; color: #b91c1c; font-weight: 600; text-transform: uppercase; margin-top: 2px;">Invalid Rows</div>
                    </div>
                </div>

                ${duplicates.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
                            Detected Duplicate Items Report (${duplicates.length} items)
                        </div>
                        <p style="font-size: 12px; color: #64748b; margin-bottom: 10px;">
                            The following menu items already exist in the database and were preserved:
                        </p>
                        <div style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table class="corp-table">
                                <thead>
                                    <tr>
                                        <th>Row</th>
                                        <th>Item Code</th>
                                        <th>Product Name</th>
                                        <th>Existing Price</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${duplicates.map(d => `
                                        <tr>
                                            <td style="color: #64748b; font-size: 12px;">#${d.row}</td>
                                            <td style="font-family: monospace; font-weight: 600; color: #0f172a;">${d.itemCode}</td>
                                            <td style="font-weight: 600; color: #1e293b;">${d.name}</td>
                                            <td style="font-weight: 700; color: #0f172a;">₹${d.existingPrice}</td>
                                            <td>
                                                <span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                                    DUPLICATE SKIPPED
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
                    <button class="btn btn-secondary" onclick='window.downloadImportAuditCSV(${JSON.stringify(report)})'>
                        Download Import Audit CSV
                    </button>
                    <button class="btn btn-primary" onclick="window.closeModal(); if (window.renderTabContentDOM) window.renderTabContentDOM();">
                        Close & Refresh Catalog
                    </button>
                </div>
            </div>
        </div>
    `;
    modalEl.classList.add('open');
};

window.downloadImportAuditCSV = (report) => {
    const duplicates = report.duplicates || [];
    const errors = report.errors || [];
    
    const headers = ['Row', 'Type', 'Item Code', 'Product Name', 'Existing Price / Error Details'];
    const rows = [
        ...duplicates.map(d => [d.row, 'DUPLICATE_SKIPPED', `"${d.itemCode}"`, `"${d.name}"`, d.existingPrice]),
        ...errors.map(e => [e.row, 'INVALID_ROW', `"${e.itemCode || '-'}"`, `"${e.name || '-'}"`, `"${e.reason}"`])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalog_import_audit_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Import audit log exported', 'success');
};
