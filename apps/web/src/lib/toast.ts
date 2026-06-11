type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; type: ToastType; duration: number; }

type Listener = (toasts: Toast[]) => void;
let toasts: Toast[] = [];
const listeners: Listener[] = [];
function notify() { listeners.forEach(l => l([...toasts])); }

export const toastStore = {
  subscribe(fn: Listener) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; },
  add(message: string, type: ToastType = 'info', duration = 3500) {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { id, message, type, duration }];
    notify();
    setTimeout(() => { toasts = toasts.filter(t => t.id !== id); notify(); }, duration);
  },
  remove(id: string) { toasts = toasts.filter(t => t.id !== id); notify(); },
};

export const toast = {
  success: (msg: string) => toastStore.add(msg, 'success'),
  error: (msg: string) => toastStore.add(msg, 'error'),
  info: (msg: string) => toastStore.add(msg, 'info'),
};
