interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div
      className="product-catalog-tabs-bar"
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--divider)',
        marginBottom: 20,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      } as React.CSSProperties}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '12px 0',
              marginRight: 32,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: isActive ? 600 : 400,
              whiteSpace: 'nowrap',
              color: isActive ? 'var(--t1)' : 'var(--bv-gold-deep)',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: -1,
              outline: 'none',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
