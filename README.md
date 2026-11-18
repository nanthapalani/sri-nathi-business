# Sri Nathi - Enterprise Business Administration Console

Centralized executive administration console for Sri Nathi Enterprise, providing governance, branch management, master catalog configuration, tax policies, role permissions, and operational auditing.

## Architecture

- **Runtime**: Pure Static Frontend (ES Modules, modern CSS system, native WebSockets)
- **Host**: Windows Server Internet Information Services (IIS)
- **Reverse Proxy**: IIS Application Request Routing (ARR) routing `/api/` and `/ws/` to backend at `127.0.0.1:8000`
- **Security**: Strict CORS validation, 2FA step-up authentication, activity timeout auto-lock, and server-authoritative permission validation.

## Deployment on Windows Server IIS

1. Open PowerShell as Administrator.
2. Execute the automated IIS deployment script:
   ```powershell
   .\deploy_business_iis.ps1 -Domain "console.srinathi.in"
   ```
3. To update code continuously:
   ```cmd
   pull_now.bat
   ```

## Directory Structure

```
├── index.html                 # Primary root application gateway
├── index_business.html        # Backward-compatible gateway alias
├── styles_business.css        # Executive typography and design tokens
├── app_business.js            # Modular application orchestrator
├── auth.js                    # Autonomous authentication and 2FA engine
├── sync.js                    # Real-time WebSocket synchronization
├── utils.js                   # Common utilities, formats, and toasts
├── tabs/                      # Module administration screens
│   ├── overview.js            # Executive KPI dashboard
│   ├── pos.js                 # Catalog and pricing management
│   ├── branches.js            # Branch management
│   ├── billing_rules.js       # Tax and billing policy
│   ├── access.js              # RBAC and employee permissions
│   ├── data_studio.js         # Master data explorer
│   ├── integrations.js        # Hardware, payment gateways, and telemetry
│   ├── branding.js            # Corporate legal identity
│   ├── activity.js            # Security and audit log explorer
│   ├── infrastructure.js      # System health and server diagnostics
│   └── archive.js             # Data archive and recycle bin
├── shared/                    # Enterprise shared client library
│   ├── db.js                  # Data layer and cache manager
│   ├── secure_storage.js      # AES encrypted browser storage
│   ├── session_guard.js       # Inactivity tracking and auto-lock screen
│   └── crypto_utils.js        # Cryptographic signing
├── web.config                 # Production IIS rewrite rules and security headers
└── deploy_business_iis.ps1    # Automated IIS installer
```
