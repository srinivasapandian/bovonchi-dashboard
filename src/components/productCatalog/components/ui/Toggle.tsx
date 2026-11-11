interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          padding: 2,
          background: checked ? 'var(--green)' : 'var(--hover)',
          border: `1px solid ${checked ? 'var(--green)' : 'var(--card-border)'}`,
          cursor: 'inherit',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: checked ? '#FFFFFF' : 'var(--t3)',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 0.2s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        />
      </button>
      {label && (
        <span style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>
          {label}
        </span>
      )}
    </label>
  );
}
