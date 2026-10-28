import type { ReactNode } from 'react';

/* Inspector row: 13px label + control */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="row-control">{children}</div>
    </div>
  );
}

interface GlassInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  small?: boolean;
}

export function GlassInput({ value, onChange, placeholder, maxLength, small }: GlassInputProps) {
  return (
    <input
      className={`g-input${small ? ' small' : ''}`}
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          className={`seg${option.value === value ? ' active' : ''}`}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      className={`toggle${checked ? ' on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

export function Slider({ value, min, max, step = 1, onChange, format }: SliderProps) {
  return (
    <div className="slider-wrap">
      <input
        className="g-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{format ? format(value) : value}</span>
    </div>
  );
}

interface GlassTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function GlassTextarea({ value, onChange, placeholder, rows = 3 }: GlassTextareaProps) {
  return (
    <textarea
      className="g-input"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** A small label above a control, for fields inside list editors. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field-stack">
      <span>{label}</span>
      {children}
    </label>
  );
}

interface SelectProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function Select<T extends string>({ value, options, onChange, ariaLabel }: SelectProps<T>) {
  return (
    <select className="g-input g-select" value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
