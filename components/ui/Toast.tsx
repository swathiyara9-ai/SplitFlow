'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type: ToastType, duration?: number) => string;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  loading: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastListener: ((toast: Toast) => void) | null = null;
let dismissListener: ((id: string) => void) | null = null;

export function useToast() {
  const context = useContext(ToastContext);
  if (context) return context;

  // Fallback for outside-context usage
  return {
    toast: (message: string, type: ToastType, duration?: number) => {
      const id = Math.random().toString();
      if (toastListener) toastListener({ id, message, type, duration });
      return id;
    },
    success: (message: string, duration?: number) => {
      const id = Math.random().toString();
      if (toastListener) toastListener({ id, message, type: 'success', duration });
      return id;
    },
    error: (message: string, duration?: number) => {
      const id = Math.random().toString();
      if (toastListener) toastListener({ id, message, type: 'error', duration });
      return id;
    },
    loading: (message: string, duration?: number) => {
      const id = Math.random().toString();
      if (toastListener) toastListener({ id, message, type: 'loading', duration });
      return id;
    },
    dismiss: (id: string) => {
      if (dismissListener) dismissListener(id);
    },
  };
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListener = (newToast) => {
      setToasts((prev) => [...prev, newToast]);
      
      if (newToast.type !== 'loading') {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration || 4000);
      }
    };

    dismissListener = (id) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return () => {
      toastListener = null;
      dismissListener = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            layout
            className="pointer-events-auto glass-panel rounded-xl p-4 flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              {t.type === 'success' && (
                <CheckCircle className="w-5 h-5 text-success shrink-0" />
              )}
              {t.type === 'error' && (
                <AlertCircle className="w-5 h-5 text-danger shrink-0" />
              )}
              {t.type === 'loading' && (
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              )}
              <span className="text-xs font-medium">{t.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-stone-400 hover:text-stone-200 p-1 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
