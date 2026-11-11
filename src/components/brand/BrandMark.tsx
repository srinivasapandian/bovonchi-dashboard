import logo from '../../assets/bovonchi-logo.png';

const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || 'BOVONCHI';

/** Roundel + letter-spaced wordmark, as on the storefront header. */
export default function BrandMark({
  size = 40,
  showWordmark = true,
  wordmarkSize = 18,
  stacked = false,
}: {
  size?: number;
  showWordmark?: boolean;
  wordmarkSize?: number;
  /** Logo above the wordmark (flex column, centred) instead of side by side. */
  stacked?: boolean;
}) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: stacked ? 12 : 14 }}>
      <img
        src={logo}
        alt={BRAND_NAME}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      />
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--bv-font-display)',
            fontWeight: 600,
            fontSize: wordmarkSize,
            letterSpacing: '0.42em',
            marginRight: stacked ? '-0.42em' : 0, // trailing letter-space would otherwise push the centred word off-centre
            color: 'var(--bv-ink)',
            lineHeight: 1,
          }}
        >
          {BRAND_NAME}
        </span>
      )}
    </div>
  );
}
