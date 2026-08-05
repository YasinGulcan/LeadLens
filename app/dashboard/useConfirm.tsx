"use client";

import { useCallback, useState } from "react";

interface ConfirmState {
  message: string;
  danger: boolean;
  resolve: (result: boolean) => void;
}

/** Tarayıcının çirkin window.confirm() kutusu yerine panel temasına uyan bir onay diyaloğu. */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string, options?: { danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, danger: options?.danger ?? false, resolve });
    });
  }, []);

  function settle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => settle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <p className="text-sm text-neutral-800 dark:text-neutral-200">{state.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => settle(false)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            İptal
          </button>
          <button
            onClick={() => settle(true)}
            className={
              state.danger
                ? "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                : "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            }
          >
            Onayla
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
