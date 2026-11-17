import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationContextData {
  showNotification: (type: NotificationType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (options: ConfirmDialogOptions | string, onConfirm?: () => void) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextData | null>(null);

// Instância global para chamadas fora da árvore de componentes se necessário
let globalNotify: NotificationContextData | null = null;

export const notify = {
  success: (title: string, message?: string) => globalNotify?.success(title, message),
  error: (title: string, message?: string) => globalNotify?.error(title, message),
  warning: (title: string, message?: string) => globalNotify?.warning(title, message),
  info: (title: string, message?: string) => globalNotify?.info(title, message),
  confirm: (options: ConfirmDialogOptions | string, onConfirm?: () => void) => globalNotify?.confirm(options, onConfirm)
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((type: NotificationType, title: string, message?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, title, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, [dismiss]);

  const success = useCallback((title: string, message?: string) => showNotification('success', title, message), [showNotification]);
  const error = useCallback((title: string, message?: string) => showNotification('error', title, message, 5000), [showNotification]);
  const warning = useCallback((title: string, message?: string) => showNotification('warning', title, message), [showNotification]);
  const info = useCallback((title: string, message?: string) => showNotification('info', title, message), [showNotification]);

  const confirm = useCallback((options: ConfirmDialogOptions | string, onConfirmAction?: () => void) => {
    if (typeof options === 'string') {
      setConfirmDialog({
        title: 'Confirmação',
        message: options,
        onConfirm: () => {
          setConfirmDialog(null);
          if (onConfirmAction) onConfirmAction();
        },
        onCancel: () => setConfirmDialog(null)
      });
    } else {
      setConfirmDialog({
        ...options,
        onConfirm: () => {
          setConfirmDialog(null);
          options.onConfirm();
        },
        onCancel: () => {
          setConfirmDialog(null);
          if (options.onCancel) options.onCancel();
        }
      });
    }
  }, []);

  const contextValue: NotificationContextData = {
    showNotification,
    success,
    error,
    warning,
    info,
    confirm,
    dismiss
  };

  globalNotify = contextValue;

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Container de Toasts Flutuantes In-App */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
        {notifications.map((n) => {
          const isError = n.type === 'error';
          const isSuccess = n.type === 'success';
          const isWarning = n.type === 'warning';

          const borderColor = isError
            ? 'border-[#b24a52]'
            : isSuccess
            ? 'border-[#5a7a5a]'
            : isWarning
            ? 'border-[#c9a04e]'
            : 'border-[#3a3530]';

          const iconColor = isError
            ? 'text-[#b24a52]'
            : isSuccess
            ? 'text-[#5a7a5a]'
            : isWarning
            ? 'text-[#c9a04e]'
            : 'text-[#8a8578]';

          return (
            <div
              key={n.id}
              className={`pointer-events-auto bg-[#1a1816]/95 border ${borderColor} rounded-2xl p-3.5 shadow-sm backdrop-blur-md flex items-start space-x-3 transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2`}
            >
              <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                {isError && <AlertCircle className="w-5 h-5" />}
                {isSuccess && <CheckCircle2 className="w-5 h-5" />}
                {isWarning && <AlertTriangle className="w-5 h-5" />}
                {n.type === 'info' && <Info className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-serif font-bold text-sm text-[#c9a04e] leading-snug">
                  {n.title}
                </h4>
                {n.message && (
                  <p className="text-xs text-[#ece3d0] font-sans mt-0.5 leading-relaxed break-words">
                    {n.message}
                  </p>
                )}
                <div className="text-[9px] font-mono text-[#8a8578] mt-1 select-none">
                  [IIII]
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismiss(n.id)}
                className="text-[#8a8578] hover:text-[#ece3d0] p-1 shrink-0 transition-all duration-300 ease-in-out"
                title="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação In-App — Tinta, Papel e Latão */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1816] border border-[#2c2825] rounded-2xl max-w-md w-full p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 border-b border-[#2c2825] pb-3">
              <div className="p-2 bg-[#2c2825] rounded-lg text-[#c9a04e]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-lg text-[#c9a04e]">
                {confirmDialog.title || 'Atenção'}
              </h3>
            </div>

            <p className="text-sm text-[#ece3d0] font-sans leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#2c2825]">
              <button
                type="button"
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 bg-[#2c2825] hover:bg-[#3a3530] text-[#ece3d0] rounded-2xl text-xs font-serif font-semibold transition-all duration-300 ease-in-out"
              >
                {confirmDialog.cancelLabel || 'Cancelar'}
              </button>

              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-2xl text-xs font-serif font-bold transition-all duration-300 ease-in-out shadow-md ${
                  confirmDialog.isDestructive
                    ? 'bg-[#b24a52] hover:bg-[#b24a52]/80 text-[#ece3d0]'
                    : 'bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211]'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification deve ser usado dentro de um NotificationProvider');
  }
  return context;
};
