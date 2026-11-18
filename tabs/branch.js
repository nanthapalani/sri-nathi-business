import { getDB } from '/shared/db.js?v=14';
import { formatINR, formatDateTime, getIcons } from '../utils.js';

export const renderBranchTab = () => {
    let html = '';
    
};

window.deleteUnit = (unitId) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    const db = getDB();
    if (db.units) {
        db.units = db.units.filter(u => u.id !== unitId && u.code !== unitId);
        saveDB(db);
        window.renderTabContentDOM();
        window.showToast('Branch deleted successfully', 'success');
        if (window.logAudit) {
            const activeUserId = window.state?.currentUser?.id || 'SYSTEM';
            const activeUnit = window.state?.activeUnitId || 'unit-1';
            logAudit(activeUserId, activeUnit, 'DELETE_UNIT', `Deleted unit ${unitId}`);
        }
    }
};

window.saveNewBranch = async () => {
    const code = document.getElementById('modal-branch-code').value.trim();
    const name = document.getElementById('modal-branch-name').value.trim();
    
    if (!code || !name) {
        window.showToast('Please fill all required fields', 'error');
        return;
    }
    
    const db = getDB();
    if (!db.units) db.units = [];
    const existing = db.units.find(u => u.code.toLowerCase() === code.toLowerCase());
    if (existing) {
        window.showToast('Unit code already exists. Please choose another.', 'error');
        return;
    }
    
    window.showLoading('Creating Branch...');
    try {
        db.units.push({ 
            id: code, 
            code: code, 
            name: name
        });
        await saveDB(db);
        window.closeModal();
        if (window.showSuccessOverlay) {
            window.showSuccessOverlay('Unit saved successfully');
        } else {
            window.showToast('Unit saved successfully', 'success');
        }
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    } catch (e) {
        window.showToast('Failed to save branch', 'error');
    } finally {
        window.hideLoading();
    }
};

window.deleteUnit = (unitId) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    const db = getDB();
    if (db.units) {
        db.units = db.units.filter(u => u.id !== unitId && u.code !== unitId);
        saveDB(db);
        window.renderTabContentDOM();
        window.showToast('Branch deleted successfully', 'success');
        if (window.logAudit) {
            const activeUserId = window.state?.currentUser?.id || 'SYSTEM';
            const activeUnit = window.state?.activeUnitId || 'unit-1';
            logAudit(activeUserId, activeUnit, 'DELETE_UNIT', `Deleted unit ${unitId}`);
        }
    }
};

window.saveNewBranch = async () => {
    const code = document.getElementById('modal-branch-code').value.trim();
    const name = document.getElementById('modal-branch-name').value.trim();
    
    if (!code || !name) {
        window.showToast('Please fill all required fields', 'error');
        return;
    }
    
    const db = getDB();
    if (!db.units) db.units = [];
    const existing = db.units.find(u => u.code.toLowerCase() === code.toLowerCase());
    if (existing) {
        window.showToast('Unit code already exists. Please choose another.', 'error');
        return;
    }
    
    window.showLoading('Creating Branch...');
    try {
        db.units.push({ 
            id: code, 
            code: code, 
            name: name
        });
        await saveDB(db);
        window.closeModal();
        if (window.logAudit) {
            const activeUserId = window.state?.currentUser?.id || 'SYSTEM';
            const activeUnit = window.state?.activeUnitId || 'unit-1';
            logAudit(activeUserId, activeUnit, 'ADD_UNIT', `Added new unit ${code} (${name})`);
        }
        if (window.showSuccessOverlay) {
            window.showSuccessOverlay('Unit saved successfully');
        } else {
            window.showToast('Unit saved successfully', 'success');
        }
        if (window.renderTabContentDOM) window.renderTabContentDOM();
    } catch (e) {
        window.showToast('Failed to save branch', 'error');
    } finally {
        window.hideLoading();
    }
};
