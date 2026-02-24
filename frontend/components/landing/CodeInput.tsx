'use client';

import { useRef, useState, KeyboardEvent, ClipboardEvent } from 'react';

interface CodeInputProps {
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export function CodeInput({ onComplete, disabled = false }: CodeInputProps) {
  const [values, setValues] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (i: number) => {
    if (i >= 0 && i < 6) inputRefs.current[i]?.focus();
  };

  const handleChange = (i: number, val: string) => {
    const char = val.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
    const next = [...values];
    next[i] = char;
    setValues(next);
    if (char && i < 5) focusBox(i + 1);
    if (next.every((c) => c !== '')) {
      onComplete(next.join(''));
    }
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (values[i]) {
        const next = [...values];
        next[i] = '';
        setValues(next);
      } else if (i > 0) {
        focusBox(i - 1);
        const next = [...values];
        next[i - 1] = '';
        setValues(next);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight' && i < 5) {
      focusBox(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    const next = [...values];
    for (let j = 0; j < text.length; j++) next[j] = text[j];
    setValues(next);
    focusBox(Math.min(text.length, 5));
    if (next.filter((c) => c !== '').length === 6) {
      onComplete(next.join(''));
    }
  };

  return (
    <div className="flex items-center gap-2 justify-center">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="text"
          maxLength={2}
          value={val}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className={`
            w-11 h-14 text-center text-xl font-[family-name:var(--font-mono)] font-bold uppercase
            bg-[#111113] border-2 rounded-xl outline-none transition-all duration-150
            ${disabled ? 'opacity-40 cursor-not-allowed border-[#222225] text-[#55555E]' : ''}
            ${!disabled && val ? 'border-[#FFB800] text-[#FFB800]' : 'border-[#222225] text-[#EAEAEC]'}
            focus:border-[#FFB800] focus:shadow-[0_0_0_3px_rgba(255,184,0,0.15)]
            caret-[#FFB800]
          `}
        />
      ))}
    </div>
  );
}
