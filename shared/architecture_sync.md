# Sri Nathi Operations Portal - Global Architecture Sync

This document serves as the cross-training knowledge base for all active sub-agents (Tony Pro, Stark, DB Agent, PDF Agent).

## 1. Frontend Architecture (Tony Pro's Domain)
- **Tech Stack:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3, Vite.
- **Routing:** Hash-based. Entry points are `app_operations_v3.js` and `business_module/app_business.js`.
- **Integrations Hub:** `business_module/tabs/platform/integrations.js` handles API configurations for Zomato/Swiggy.
- **PDF Preview Modal:** Built in `operations module/order_detail.html` using an `<iframe>` to stream PDFs from the backend securely.
- **Reporting UI:** `operations_analytics.js` has dedicated "Export PDF" and "Export CSV" capabilities.

## 2. Backend API Architecture (Stark's Domain)
- **Tech Stack:** Python 3.9, FastAPI, Uvicorn (running on 127.0.0.1:8000).
- **Delivery Router (`delivery_router.py`):** Handles In-house deliveries and aggregator webhooks. It dynamically resolves the branch `unit_id` from the payload, auto-accepts orders based on business config, and logs all webhooks to `public.webhook_audit_logs`.
- **PDF Router (`pdf_router.py`):** Contains endpoints (`/api/pdf/quote/{id}`, `/api/pdf/invoice/{id}`, `/api/pdf/report`). Uses `inline` Content-Disposition for frontend iframe previews, and enforces strict 404 error handling with `_default` partition fallbacks.
- **Sync Engine (`sync_engine.py`):** Real-time WebSocket broadcasting (`ws_manager.broadcast`) to keep the frontend Kanban UI synced.

## 3. Database Architecture (DB Agent's Domain)
- **Tech Stack:** PostgreSQL Cluster, accessed via Python `psycopg2`.
- **Partitioning Strategy:** High-volume tables (`finance.invoices`, `operations.aggregator_orders`, `operations.catering_orders`) are horizontally partitioned by `unit_id` (e.g., `_karur`, `_coimbatore`). A `_default` partition is mandatory for fallback safety.
- **CRUD Operations (`crud.py`):** Uses `pg_upsert_record` which dynamically maps Python dictionaries to actual PostgreSQL columns using `TABLE_SCHEMA_MAP` in `security.py`.
- **Data Cleanup:** All fake diagnostic data (simulated orders, webhook test logs, API audit logs, and seed invoices) have been permanently hard-deleted to maintain production integrity.

## 4. Document Engine (PDF Agent's Domain)
- **Tech Stack:** Python `fpdf2` library.
- **Engine (`pdf_engine.py`):** Utilizes a unified `CorporatePDF` base class. 
- **Corporate Styling:** A4 format, Slate Blue headers, Emerald Green accents.
- **Watermarks:** Implemented advanced context managers (`pdf.local_context(fill_opacity=0.15)`) to overlay rotated, diagonal watermarks ("DRAFT" for quotes, "TAX INVOICE" for invoices) seamlessly beneath the text.
