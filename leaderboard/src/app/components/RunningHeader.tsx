interface RunningHeaderProps {
  category: string;
  pageLabel?: string;
}

export default function RunningHeader({ category, pageLabel = "Page 1 of 1" }: RunningHeaderProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: '#faf9f6',
        borderTop: '1px solid #111',
        borderBottom: '1px solid #aaa',
        padding: '0.3rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Left: category in small-caps red */}
      <span style={{
        fontVariant: 'small-caps',
        letterSpacing: '0.1em',
        fontSize: '0.6rem',
        color: '#8b0000',
        fontFamily: 'var(--font-lora), serif',
        fontWeight: 600,
      }}>
        {category}
      </span>

      {/* Center: THE ARENA */}
      <span style={{
        fontVariant: 'small-caps',
        letterSpacing: '0.18em',
        fontSize: '0.55rem',
        color: '#111',
        fontFamily: 'var(--font-playfair), serif',
        fontWeight: 700,
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        The Arena
      </span>

      {/* Right: editorial page marker */}
      <span style={{
        fontVariant: 'small-caps',
        letterSpacing: '0.08em',
        fontSize: '0.6rem',
        color: '#555',
        fontFamily: 'var(--font-lora), serif',
      }}>
        {pageLabel}
      </span>
    </div>
  );
}
