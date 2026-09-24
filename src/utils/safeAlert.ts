/**
 * Safe notification and alert polyfill for iframe and standalone web applet environments.
 * Prevents iframe freezes and SecurityErrors caused by sandboxed window.alert.
 */

export function initSafeAlerts(): void {
  if (typeof window === 'undefined') return;

  const originalAlert = window.alert?.bind(window);

  // Setup toast container if not already present
  let toastContainer = document.getElementById('app-safe-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'app-safe-toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '1.25rem';
    toastContainer.style.right = '1.25rem';
    toastContainer.style.zIndex = '99999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '0.5rem';
    toastContainer.style.maxWidth = '24rem';
    toastContainer.style.width = 'calc(100vw - 2.5rem)';
    toastContainer.style.pointerEvents = 'none';
    document.body.appendChild(toastContainer);
  }

  window.alert = (message?: any) => {
    try {
      const msg = String(message ?? '');
      const toast = document.createElement('div');
      toast.style.pointerEvents = 'auto';
      toast.style.background = '#1e293b';
      toast.style.color = '#f8fafc';
      toast.style.border = '1px solid #3b82f6';
      toast.style.borderLeft = '4px solid #3b82f6';
      toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)';
      toast.style.borderRadius = '0.5rem';
      toast.style.padding = '0.75rem 1rem';
      toast.style.fontSize = '0.875rem';
      toast.style.lineHeight = '1.25rem';
      toast.style.display = 'flex';
      toast.style.alignItems = 'flex-start';
      toast.style.justifyContent = 'space-between';
      toast.style.gap = '0.75rem';
      toast.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px) scale(0.98)';

      const textEl = document.createElement('div');
      textEl.style.flex = '1';
      textEl.style.wordBreak = 'break-word';
      textEl.textContent = msg;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.background = 'transparent';
      closeBtn.style.border = 'none';
      closeBtn.style.color = '#94a3b8';
      closeBtn.style.fontSize = '1.25rem';
      closeBtn.style.lineHeight = '1';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.padding = '0 0.25rem';
      closeBtn.setAttribute('aria-label', 'Close');

      toast.appendChild(textEl);
      toast.appendChild(closeBtn);

      const dismiss = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px) scale(0.98)';
        setTimeout(() => {
          if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 250);
      };

      closeBtn.onclick = dismiss;
      toast.onclick = dismiss;

      const container = document.getElementById('app-safe-toast-container');
      if (container) {
        container.appendChild(toast);
        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateY(0) scale(1)';
        });

        // Auto dismiss after 4 seconds
        setTimeout(dismiss, 4000);
      } else if (originalAlert) {
        originalAlert(msg);
      }
    } catch {
      // In case DOM is not ready, fallback to original alert
      try {
        originalAlert?.(message);
      } catch {}
    }
  };
}
