interface ToastState {
  id: number;
  message: string;
}

export function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div className="toast" key={toast.id}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
