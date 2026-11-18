class ToastManager {
    constructor() {
        this.toasts = [];
        this.maxToasts = 4;
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.pillContainer = document.createElement('div');
        this.pillContainer.id = 'toast-pill-container';
        
        const mount = () => {
            if (document.body) {
                if (!this.container.parentNode) document.body.appendChild(this.container);
                if (!this.pillContainer.parentNode) document.body.appendChild(this.pillContainer);
                this.injectStyles();
            }
        };

        if (document.body) {
            mount();
        } else {
            window.addEventListener('DOMContentLoaded', mount);
        }
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 9999;
                pointer-events: none;
            }
            .toast-card {
                position: relative;
                min-width: 250px;
                max-width: 350px;
                background: #fff;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: flex-start;
                padding: 12px 16px;
                overflow: hidden;
                pointer-events: auto;
                transform: translateY(20px);
                opacity: 0;
                animation: toast-slide-up 0.3s ease forwards;
            }
            .toast-card.fade-out {
                animation: toast-fade-out 0.3s ease forwards;
            }
            @keyframes toast-slide-up {
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes toast-fade-out {
                to { transform: translateY(-10px); opacity: 0; }
            }
            .toast-icon {
                font-size: 20px;
                margin-right: 12px;
                flex-shrink: 0;
            }
            .toast-content {
                flex-grow: 1;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                color: #333;
                line-height: 1.4;
                margin-top: 2px;
            }
            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(0,0,0,0.1);
                width: 100%;
                transform-origin: left;
            }
            
            /* Types */
            .toast-card.success { border-left: 4px solid #10b981; }
            .toast-card.success .toast-progress { background: #10b981; }
            
            .toast-card.error { border-left: 4px solid #ef4444; }
            .toast-card.error .toast-progress { background: #ef4444; }
            
            .toast-card.warning { border-left: 4px solid #f59e0b; }
            .toast-card.warning .toast-progress { background: #f59e0b; }
            
            .toast-card.info { border-left: 4px solid #3b82f6; }
            .toast-card.info .toast-progress { background: #3b82f6; }

            #toast-pill-container {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                z-index: 10050;
                pointer-events: none;
            }
            .toast-pill {
                pointer-events: auto;
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 10px 14px 10px 16px;
                border-radius: 999px;
                background: #141518;
                color: #f4f4f1;
                border: 1px solid rgba(255,255,255,0.12);
                box-shadow: 0 14px 34px rgba(0,0,0,0.28);
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 13px;
                font-weight: 600;
                opacity: 0;
                transform: translateY(16px) scale(0.96);
                animation: toast-pill-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            [data-theme="dark"] .toast-pill,
            [data-theme="pure-dark"] .toast-pill,
            [data-theme="mica"] .toast-pill {
                background: #f4f4f1;
                color: #141518;
                border-color: rgba(20,21,24,0.12);
            }
            .toast-pill.fade-out {
                animation: toast-pill-out 0.24s ease forwards;
            }
            .toast-pill-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .toast-pill-action {
                margin-left: 4px;
                padding: 4px 10px;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.22);
                background: rgba(255,255,255,0.1);
                color: inherit;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.16s ease;
            }
            .toast-pill-action:hover {
                background: rgba(255,255,255,0.2);
            }
            [data-theme="dark"] .toast-pill-action,
            [data-theme="pure-dark"] .toast-pill-action,
            [data-theme="mica"] .toast-pill-action {
                border-color: rgba(20,21,24,0.2);
                background: rgba(20,21,24,0.08);
            }
            [data-theme="dark"] .toast-pill-action:hover,
            [data-theme="pure-dark"] .toast-pill-action:hover,
            [data-theme="mica"] .toast-pill-action:hover {
                background: rgba(20,21,24,0.15);
            }
            @keyframes toast-pill-in {
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes toast-pill-out {
                to { opacity: 0; transform: translateY(10px) scale(0.96); }
            }
        `;
        document.head.appendChild(style);
    }

    getIcon(type) {
        switch(type) {
            case 'success': 
                return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>';
            case 'error': 
                return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            case 'warning': 
                return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            case 'info': 
            default:
                return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        }
    }

    show({ message, type = 'info', duration = 4000, variant = 'card', actionLabel = null, onAction = null }) {
        if (this.toasts.length >= this.maxToasts) {
            this.dismiss(this.toasts[0]);
        }

        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        if (variant === 'pill') {
            const pill = document.createElement('div');
            pill.className = `toast-pill ${type}`;
            const dotColor = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#14b8a6';
            pill.innerHTML = `<span class="toast-pill-dot" style="background:${dotColor};"></span><span>${message}</span>`;

            const toastObj = { id, element: pill, timer: null };
            if (actionLabel && typeof onAction === 'function') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'toast-pill-action';
                btn.textContent = actionLabel;
                btn.onclick = () => {
                    onAction();
                    this.dismiss(toastObj);
                };
                pill.appendChild(btn);
            }

            this.toasts.push(toastObj);
            if (!this.pillContainer.parentNode && document.body) {
                document.body.appendChild(this.pillContainer);
            }
            this.pillContainer.appendChild(pill);

            toastObj.timer = setTimeout(() => {
                this.dismiss(toastObj);
            }, duration);
            return toastObj;
        }

        const card = document.createElement('div');
        card.className = `toast-card ${type}`;
        
        card.innerHTML = `
            <div class="toast-icon">${this.getIcon(type)}</div>
            <div class="toast-content">${message}</div>
            <div class="toast-progress" style="transition: transform ${duration}ms linear; transform: scaleX(1);"></div>
        `;

        const toastObj = { id, element: card, timer: null };
        this.toasts.push(toastObj);
        this.container.appendChild(card);

        // Start progress bar animation in next frame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const progress = card.querySelector('.toast-progress');
                if (progress) progress.style.transform = 'scaleX(0)';
            });
        });

        toastObj.timer = setTimeout(() => {
            this.dismiss(toastObj);
        }, duration);
        return toastObj;
    }

    dismiss(toastObj) {
        const index = this.toasts.indexOf(toastObj);
        if (index > -1) {
            this.toasts.splice(index, 1);
            clearTimeout(toastObj.timer);
            
            toastObj.element.classList.add('fade-out');
            toastObj.element.addEventListener('animationend', () => {
                toastObj.element.remove();
            }, { once: true });
        }
    }
}

window.Toast = new ToastManager();
