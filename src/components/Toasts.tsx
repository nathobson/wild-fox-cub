import { IconCheckSeal } from './icons';

export interface ToastData {
  id: number;
  message: string;
}

export function Toasts({ toasts }: { toasts: ToastData[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <IconCheckSeal size={15} className="toast-icon" />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
