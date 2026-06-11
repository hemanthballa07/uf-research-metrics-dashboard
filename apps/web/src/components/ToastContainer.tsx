import { useState, useEffect } from 'react';
import { toastStore } from '../lib/toast.js';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; type: ToastType; duration: number; }

const colorMap: Record<ToastType, string> = {
  success: '#28a745',
  error: '#dc3545',
  info: '#4a9eff',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return toastStore.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => toastStore.remove(t.id)}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            color: 'white',
            backgroundColor: colorMap[t.type],
            minWidth: 260,
            maxWidth: 380,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            opacity: 1,
            transition: 'opacity 0.2s ease',
            fontSize: '0.9rem',
            lineHeight: '1.4',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
