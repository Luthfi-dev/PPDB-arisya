import React, { useEffect, useRef, useState } from 'react';

export function formatIndonesianThousands(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseIndonesianNumber(raw: string): number {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return 0;
  const num = parseInt(digits, 10);
  return Number.isFinite(num) ? num : 0;
}

interface CurrencyInputProps {
  value: number | '' | null | undefined;
  onChange: (num: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  hideZeroWhenEmpty?: boolean;
}

/**
 * Input mata uang Rupiah dengan auto-format pemisah ribuan titik (1000 -> 1.000, 100000 -> 100.000)
 * tanpa menyisakan angka "0" yang sulit dihapus, namun tetap mengirimkan nilai integer murni ke onChange.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = 'Contoh: 100.000',
  max = 1000000000,
  required = false,
  disabled = false,
  className = '',
  id,
  name,
  hideZeroWhenEmpty = true,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedRef = useRef<number | null>(null);

  const toDisplay = (v: number | '' | null | undefined): string => {
    if (v === '' || v === null || v === undefined) return '';
    if (typeof v === 'number') {
      if (!Number.isFinite(v) || (hideZeroWhenEmpty && v <= 0)) return '';
      return formatIndonesianThousands(Math.round(v));
    }
    return formatIndonesianThousands(v);
  };

  const [displayValue, setDisplayValue] = useState<string>(() => toDisplay(value));

  useEffect(() => {
    const numericProp =
      value === '' || value === null || value === undefined ? 0 : Math.round(Number(value) || 0);
    // Hanya sinkron ulang jika prop berubah dari luar (bukan pantulan dari ketikan user sendiri)
    if (lastEmittedRef.current !== null && numericProp === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = numericProp;
    setDisplayValue(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const selectionStart = e.target.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw.slice(0, selectionStart).replace(/\D/g, '').length;

    const rawDigits = raw.replace(/\D/g, '');
    if (!rawDigits) {
      lastEmittedRef.current = 0;
      setDisplayValue('');
      onChange(0);
      return;
    }

    let num = parseInt(rawDigits, 10);
    if (!Number.isFinite(num)) num = 0;
    if (typeof max === 'number' && num > max) {
      num = max;
    }

    const formatted = formatIndonesianThousands(num);
    lastEmittedRef.current = num;
    setDisplayValue(formatted);
    onChange(num);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      let targetPos = 0;
      let seenDigits = 0;
      while (targetPos < formatted.length && seenDigits < digitsBeforeCaret) {
        if (/\d/.test(formatted[targetPos])) {
          seenDigits += 1;
        }
        targetPos += 1;
      }
      try {
        el.setSelectionRange(targetPos, targetPos);
      } catch {
        // Ignore selection errors on unsupported elements
      }
    });
  };

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      required={required}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

interface PlainNumberInputProps {
  value: number | '' | null | undefined;
  onChange: (num: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  allowZeroDisplay?: boolean;
}

/**
 * Input angka non-mata-uang (kuota, nilai tes, jumlah offline) tanpa bug angka "0" terkunci
 * saat user menekan Backspace atau menghapus isi input.
 */
export const PlainNumberInput: React.FC<PlainNumberInputProps> = ({
  value,
  onChange,
  placeholder = '',
  max,
  required = false,
  disabled = false,
  className = '',
  id,
  name,
  allowZeroDisplay = false,
}) => {
  const lastEmittedRef = useRef<number | null>(null);

  const toDisplay = (v: number | '' | null | undefined): string => {
    if (v === '' || v === null || v === undefined) return '';
    const num = Number(v);
    if (!Number.isFinite(num)) return '';
    if (num === 0 && !allowZeroDisplay) return '';
    return String(Math.floor(num));
  };

  const [displayValue, setDisplayValue] = useState<string>(() => toDisplay(value));

  useEffect(() => {
    const numericProp =
      value === '' || value === null || value === undefined ? 0 : Math.floor(Number(value) || 0);
    if (lastEmittedRef.current !== null && numericProp === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = numericProp;
    setDisplayValue(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      lastEmittedRef.current = 0;
      setDisplayValue('');
      onChange(0);
      return;
    }

    let num = parseInt(digits, 10);
    if (!Number.isFinite(num)) num = 0;
    if (typeof max === 'number' && num > max) {
      num = max;
    }

    const cleanStr = String(num);
    lastEmittedRef.current = num;
    setDisplayValue(cleanStr);
    onChange(num);
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      required={required}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};
