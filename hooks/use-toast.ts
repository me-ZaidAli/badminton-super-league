"use client";

import { useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";

export type ToastVariant = "default" | "destructive";

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ReactNode;
  duration?: number;
}

export interface Toast extends Required<Pick<ToastOptions, "id">> {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ReactNode;
  open: boolean;
}

let _counter = 0;
const listeners: Set<React.Dispatch<React.SetStateAction<Toast[]>>> = new Set();
let _toasts: Toast[] = [];

export function toast(options: ToastOptions) {
  const id = options.id ?? `toast-${++_counter}`;
  const next: Toast = { ...options, id, open: true };
  _toasts = [..._toasts, next];
  listeners.forEach((fn) => fn([..._toasts]));
  // Auto-dismiss
  const ms = options.duration ?? 4000;
  setTimeout(() => dismiss(id), ms);
}

function dismiss(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id);
  listeners.forEach((fn) => fn([..._toasts]));
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(_toasts);
  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);
  return {
    toasts,
    toast,
    dismiss,
  };
}
