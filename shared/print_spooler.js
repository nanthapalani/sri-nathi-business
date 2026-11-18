// ==========================================================================
// SRI NATHI ENTERPRISE - UNIVERSAL CROSS-BROWSER PRINT DISPATCH ENGINE
// Works across Edge, Chrome, Firefox, Safari, Brave, Opera, & Electron Windows
// ==========================================================================

class UniversalPrintSpooler {
  constructor() {
    this.ensurePrintStylesheet();
  }

  ensurePrintStylesheet() {
    if (!document.getElementById('universalPrintStyleLink')) {
      const link = document.createElement('link');
      link.id = 'universalPrintStyleLink';
      link.rel = 'stylesheet';
      link.href = '/shared/print_styles.css';
      document.head.appendChild(link);
    }
  }

  // 1. Format & Spool POS Billing Receipt (Thermal 80mm / 58mm Alignment)
  printPOSReceipt(orderData = {}) {
    const db = window.getDB ? window.getDB() : {};
    const settings = (db.business_settings && db.business_settings[0]) || {};
    const paperSize = settings.printerPaperSize || '80mm';
    const headerTitle = settings.receiptHeader || settings.name || 'SRI NATHI FOOD SERVICES';
    const footerMsg = settings.receiptFooter || 'Thank you for dining with Sri Nathi! Visit again!';

    // Dynamically resolve active unit from DB or state
    const activeUnitId = (window.state && window.state.activeUnitId) || (orderData && orderData.unit_id) || 'unit-1';
    const units = (db.units && Array.isArray(db.units)) ? db.units : [];
    const activeUnit = units.find(u => u.id === activeUnitId || u.code === activeUnitId) || {};

    const branchName = activeUnit.name || 'Main Branch';
    const branchAddress = activeUnit.address || '';
    const branchGstin = activeUnit.gstin || settings.gstin || '';
    const branchPhone = activeUnit.manager_phone || activeUnit.phone || '';
    const isReprint = Boolean(orderData.is_reprint || orderData.isReprint);

    const items = orderData.items || [];
    const subtotal = Number(orderData.subtotal || items.reduce((acc, i) => acc + (Number(i.total || i.price * i.qty) || 0), 0));
    const gstAmount = Number(orderData.gstAmount || orderData.gst_amount || 0);
    const containerFee = Number(orderData.containerFee || orderData.container_fee || 0);
    const discountAmount = Number(orderData.discountAmount || orderData.discount_amount || 0);
    const grandTotal = Number(orderData.total_amount || orderData.totalAmount || orderData.grandTotal || (subtotal + gstAmount + containerFee - discountAmount));

    const alignmentClass = paperSize === '58mm' ? 'print-receipt-58mm' : 'print-receipt-80mm';

    const htmlContent = `
      <div class="${alignmentClass}">
        ${isReprint ? '<div class="print-center print-bold" style="font-size: 13px; color: #b91c1c; border: 1px dashed #b91c1c; padding: 2px 4px; margin-bottom: 6px;">*** DUPLICATE / REPRINT ***</div>' : ''}
        <div class="print-center print-bold" style="font-size: 16px; margin-bottom: 2px;">${headerTitle}</div>
        <div class="print-center" style="font-size: 11px; font-weight: 600;">${branchName}</div>
        ${branchAddress ? `<div class="print-center" style="font-size: 10px; color: #475569;">${branchAddress}</div>` : ''}
        ${branchGstin ? `<div class="print-center" style="font-size: 10px;">GSTIN: <strong>${branchGstin}</strong></div>` : ''}
        ${branchPhone ? `<div class="print-center" style="font-size: 10px;">Ph: ${branchPhone}</div>` : ''}
        
        <div class="print-divider"></div>
        
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Bill No: <strong>${orderData.id || orderData.invoice_number || 'N/A'}</strong></span>
          <span>${orderData.date || new Date().toLocaleDateString('en-IN')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Table / Type: <strong>${orderData.tableNumber || orderData.tableName || orderData.table_number || orderData.orderType || 'Dine-In'}</strong></span>
          <span>${orderData.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${orderData.customerName || orderData.customerMobile ? `<div style="font-size: 10px; color: #475569;">Customer: ${orderData.customerName || ''} ${orderData.customerMobile ? '(' + orderData.customerMobile + ')' : ''}</div>` : ''}
        
        <div class="print-divider"></div>

        <table class="print-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="print-center">Qty</th>
              <th class="print-right">Rate</th>
              <th class="print-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? '<tr><td colspan="4" class="print-center" style="color: #94a3b8;">No items</td></tr>' : items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="print-center">${item.qty}</td>
                <td class="print-right">${Number(item.price || 0).toFixed(2)}</td>
                <td class="print-right">${(Number(item.total || item.price * item.qty) || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="print-divider"></div>

        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Subtotal:</span>
          <span class="print-right">Rs. ${subtotal.toFixed(2)}</span>
        </div>
        ${discountAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #15803d;">
          <span>Discount:</span>
          <span class="print-right">-Rs. ${discountAmount.toFixed(2)}</span>
        </div>` : ''}
        ${gstAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>GST:</span>
          <span class="print-right">Rs. ${gstAmount.toFixed(2)}</span>
        </div>` : ''}
        ${containerFee > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Container Fee:</span>
          <span class="print-right">Rs. ${containerFee.toFixed(2)}</span>
        </div>` : ''}
        
        <div class="print-divider"></div>

        <div style="display: flex; justify-content: space-between; font-size: 15px;" class="print-bold">
          <span>NET PAYABLE:</span>
          <span class="print-right">Rs. ${grandTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
          <span>Payment Mode:</span>
          <span class="print-right"><strong>${orderData.paymentMode || orderData.payment_method || 'CASH'}</strong></span>
        </div>

        <div class="print-divider"></div>
        <div class="print-center" style="font-size: 10px; margin-top: 6px;">${footerMsg}</div>
        <div class="print-center" style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Powered by Sri Nathi Operations</div>
      </div>
    `;

    this.triggerUniversalPrint(htmlContent, 'POS Receipt');
  }

  // 2. Format & Spool Events & Invoice Document (A4 Full-Page Alignment)
  printEventsInvoice(eventData = {}) {
    const items = eventData.items || [
      { description: 'Premium Buffet Service (Non-Veg & Veg Spread)', pax: 250, rate: 450, total: 112500 },
      { description: 'Grand Hall Floral Stage Decoration & Lighting', pax: 1, rate: 25000, total: 25000 },
      { description: 'Live Welcome Beverage Counter & Mocktail Bar', pax: 250, rate: 60, total: 15000 }
    ];

    const subtotal = eventData.subtotal || items.reduce((acc, i) => acc + i.total, 0);
    const cgst = Math.round(subtotal * 0.09 * 100) / 100;
    const sgst = Math.round(subtotal * 0.09 * 100) / 100;
    const totalGst = cgst + sgst;
    const grandTotal = subtotal + totalGst;

    const htmlContent = `
      <div class="print-invoice-a4">
        <!-- Letterhead Header Banner -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0284C7;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0284C7; margin: 0;">SRI NATHI CATERING & EVENTS</h1>
            <div style="font-size: 12px; color: #475569; margin-top: 4px;">Grand Event Catering, Banquet Booking & Outdoor Dining</div>
            <div style="font-size: 12px; color: #475569;">Karur Main Road, Tamil Nadu | GSTIN: 33AAAAA0000A1Z5</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 20px; font-weight: 800; color: #1E293B;">TAX INVOICE</div>
            <div style="font-size: 13px; font-weight: 700; color: #0284C7; margin-top: 4px;">No: ${eventData.invoiceNo || 'EVT-INV-2026-904'}</div>
            <div style="font-size: 12px; color: #64748B;">Date: ${eventData.date || new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <!-- Customer & Event Meta -->
        <div style="display: flex; justify-content: space-between; margin: 20px 0; padding: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Billed To:</div>
            <div style="font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 2px;">${eventData.customerName || 'Kavin Rajan & Family'}</div>
            <div style="font-size: 12px; color: #475569;">Mobile: ${eventData.customerPhone || '+91 98421 12345'}</div>
            <div style="font-size: 12px; color: #475569;">Venue: ${eventData.venue || 'Sri Nathi Grand Ballroom, Karur'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Event Details:</div>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 2px;">${eventData.eventType || 'Wedding Reception & Banquet'}</div>
            <div style="font-size: 12px; color: #475569;">Guest Count: ${eventData.guestCount || 250} Pax</div>
            <div style="font-size: 12px; font-weight: 700; color: #16A34A; margin-top: 4px;">Status: PAID IN FULL</div>
          </div>
        </div>

        <!-- Itemized Table -->
        <table class="print-table print-table-a4">
          <thead>
            <tr style="background: #F1F5F9;">
              <th style="font-size: 12px; font-weight: 700;">#</th>
              <th style="font-size: 12px; font-weight: 700;">Event Description / Services</th>
              <th class="print-center" style="font-size: 12px; font-weight: 700;">Pax / Units</th>
              <th class="print-right" style="font-size: 12px; font-weight: 700;">Rate (Rs)</th>
              <th class="print-right" style="font-size: 12px; font-weight: 700;">Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong style="color: #0F172A;">${item.description}</strong></td>
                <td class="print-center">${item.pax}</td>
                <td class="print-right">${item.rate.toFixed(2)}</td>
                <td class="print-right" style="font-weight: 700;">${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Tax & Totals Breakdown -->
        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <div style="width: 320px;">
            <div style="display: flex; justify-content: space-between; padding: 6px 0;">
              <span>Subtotal Amount:</span>
              <span class="print-bold">Rs. ${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0;">
              <span>CGST (9%):</span>
              <span>Rs. ${cgst.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 6px 0;">
              <span>SGST (9%):</span>
              <span>Rs. ${sgst.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #0F172A; border-bottom: 2px solid #0F172A; font-size: 16px;" class="print-bold">
              <span>GRAND TOTAL:</span>
              <span style="color: #0284C7;">Rs. ${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Signature & Terms -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px;">
          <div style="font-size: 11px; color: #64748B;">
            <div><strong>Terms & Conditions:</strong></div>
            <div>1. All catering & event services billed in accordance with GST rules.</div>
            <div>2. Thank you for choosing Sri Nathi Catering & Events!</div>
          </div>
          <div style="text-align: center;">
            <div style="border-bottom: 1px solid #94A3B8; width: 180px; margin-bottom: 6px;"></div>
            <div style="font-size: 12px; font-weight: 700; color: #0F172A;">Authorized Signatory</div>
            <div style="font-size: 11px; color: #64748B;">Sri Nathi Enterprise</div>
          </div>
        </div>
      </div>
    `;

    this.triggerUniversalPrint(htmlContent, 'Events Invoice');
  }

  // 3. Trigger Universal Native Print (Edge, Chrome, Firefox, Safari, Brave, Electron)
  triggerUniversalPrint(htmlContent, docTitle = 'Document') {
    console.log(`[Universal Spooler] Triggering OS/Browser native print for ${docTitle}...`);

    let printContainer = document.getElementById('universalPrintContainer');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'universalPrintContainer';
      document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = htmlContent;

    // Trigger universal OS / Browser System Print Dialog
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (printContainer) printContainer.innerHTML = '';
      }, 500);
    }, 150);
  }



  // Format & Spool KOT (Kitchen Order Ticket)
  printKOT(kotData = {}) {
    const items = kotData.items || [];
    const kotNo = kotData.kot_number || kotData.kotNumber || 'KOT';
    const tableNo = kotData.table_number || kotData.tableNumber || kotData.tableName || 'Dine-In';
    const orderType = kotData.order_type || kotData.orderType || 'Dine-in';
    const timeStr = kotData.server_time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const htmlContent = `
      <div class="print-receipt-80mm">
        <div class="print-center print-bold" style="font-size: 18px; margin-bottom: 4px;">*** KITCHEN TICKET ***</div>
        <div class="print-center" style="font-size: 16px; font-weight: 800; margin-bottom: 6px; letter-spacing: 1px;">[ ${kotNo} ]</div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 2px;">
          <span>Table: <strong style="font-size: 16px;">${tableNo}</strong></span>
          <span>Type: <strong>${orderType}</strong></span>
        </div>
        <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">Time: ${timeStr} | Server: ${kotData.cashier || 'Cashier'}</div>
        
        <div class="print-divider"></div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="font-size: 13px; text-align: left;">Dish</th>
              <th class="print-center" style="font-size: 13px; width: 60px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="font-size: 14px; font-weight: 700; padding: 6px 0;">${item.name}</td>
                <td class="print-center print-bold" style="font-size: 16px; padding: 6px 0;">${item.qty || 1}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="print-divider"></div>
        <div class="print-center" style="font-size: 10px; margin-top: 4px;">- END OF TICKET -</div>
      </div>
    `;
    this.triggerUniversalPrint(htmlContent, `KOT-${tableNo}`);
  }
}
window.universalPrintSpooler = new UniversalPrintSpooler();
