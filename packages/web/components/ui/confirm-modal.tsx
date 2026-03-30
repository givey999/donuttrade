'use client';

import { useState } from 'react';
import { Modal } from './modal';
import { Button } from './button';
import { Input } from './input';

interface ConfirmModalProps {
  title: string;
  message: string;
  /** If set, shows a text input field with this placeholder */
  inputPlaceholder?: string;
  /** Whether the input is required to confirm */
  inputRequired?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'success';
  onConfirm: (inputValue?: string) => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  inputPlaceholder,
  inputRequired = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (inputRequired && !inputValue.trim()) return;
    setLoading(true);
    try {
      await onConfirm(inputPlaceholder ? inputValue : undefined);
    } finally {
      setLoading(false);
    }
  };

  const canConfirm = !inputRequired || inputValue.trim().length > 0;

  return (
    <Modal onClose={onCancel}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{message}</p>

      {inputPlaceholder && (
        <div className="mt-3">
          <Input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
            onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) handleConfirm(); }}
          />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant={variant}
          onClick={handleConfirm}
          disabled={loading || !canConfirm}
          className="flex-1"
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={loading} className="flex-1">
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
