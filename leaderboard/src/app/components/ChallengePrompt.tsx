import ReactMarkdown from "react-markdown";

interface ChallengePromptProps {
  prompt: string;
}

export default function ChallengePrompt({ prompt }: ChallengePromptProps) {
  return (
    <div style={{
      background: '#fff',
      borderTop: '2px solid #1a3a5c',
      borderBottom: '1px solid #d4c9b0',
      borderLeft: '4px solid #1a3a5c',
      borderRight: '1px solid #d4c9b0',
      padding: '1.75rem 2.25rem',
    }}>
      <h2 style={{
        fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
        fontSize: '0.65rem',
        fontVariant: 'small-caps',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#b8860b',
        marginBottom: '1.25rem',
        paddingBottom: '0.6rem',
        borderBottom: '1px solid #d4c9b0',
      }}>
        Challenge Specification
      </h2>
      <div style={{
        fontFamily: 'var(--font-eb-garamond), Georgia, serif',
        fontSize: '1.0625rem',
        lineHeight: '1.85',
        color: '#2c2c2c',
      }}>
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 style={{
                fontFamily: 'var(--font-eb-garamond), Georgia, serif',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#1a3a5c',
                marginTop: '1.75rem',
                marginBottom: '0.75rem',
                paddingBottom: '0.35rem',
                borderBottom: '1px solid #d4c9b0',
                lineHeight: 1.3,
              }}>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 style={{
                fontFamily: 'var(--font-eb-garamond), Georgia, serif',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#1a3a5c',
                marginTop: '1.5rem',
                marginBottom: '0.5rem',
                lineHeight: 1.3,
              }}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 style={{
                fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
                fontSize: '0.75rem',
                fontVariant: 'small-caps',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6b5a44',
                marginTop: '1.25rem',
                marginBottom: '0.4rem',
              }}>{children}</h3>
            ),
            p: ({ children }) => (
              <p style={{ marginBottom: '1rem', textIndent: '1.5em' }}>{children}</p>
            ),
            ul: ({ children }) => (
              <ul style={{ marginBottom: '1rem', paddingLeft: '2em', listStyleType: 'disc' }}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol style={{ marginBottom: '1rem', paddingLeft: '2em', listStyleType: 'decimal' }}>{children}</ol>
            ),
            li: ({ children }) => (
              <li style={{ marginBottom: '0.3rem' }}>{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeft: '3px solid #b8860b',
                paddingLeft: '1.25rem',
                paddingTop: '0.25rem',
                paddingBottom: '0.25rem',
                margin: '1.5rem 0',
                color: '#4a3f2f',
                fontStyle: 'italic',
                background: '#faf7f0',
              }}>{children}</blockquote>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code style={{
                    fontFamily: 'var(--font-ibm-plex-sans), monospace',
                    fontSize: '0.875em',
                    background: '#f0ebe0',
                    color: '#1a3a5c',
                    padding: '0.1em 0.35em',
                    border: '1px solid #d4c9b0',
                  }}>{children}</code>
                );
              }
              return (
                <code style={{ fontFamily: 'var(--font-ibm-plex-sans), monospace' }} className={className}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre style={{
                fontFamily: 'var(--font-ibm-plex-sans), monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                background: '#f5f0e8',
                border: '1px solid #d4c9b0',
                padding: '1.25rem',
                overflowX: 'auto',
                marginBottom: '1rem',
              }}>{children}</pre>
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: 600, color: '#1a3a5c' }}>{children}</strong>
            ),
            a: ({ href, children }) => (
              <a href={href} style={{ color: '#1a3a5c', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{children}</a>
            ),
            table: ({ children }) => (
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9375rem', border: '1px solid #d4c9b0' }}>
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead style={{ background: '#faf7f0', borderBottom: '2px solid #d4c9b0' }}>{children}</thead>
            ),
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => (
              <tr style={{ borderBottom: '1px solid #e8e0d0' }}>{children}</tr>
            ),
            th: ({ children }) => (
              <th style={{
                padding: '0.5rem 0.9rem',
                textAlign: 'left',
                fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
                fontSize: '0.7rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#1a3a5c',
                fontWeight: 600,
              }}>{children}</th>
            ),
            td: ({ children }) => (
              <td style={{ padding: '0.5rem 0.9rem', color: '#2c2c2c' }}>{children}</td>
            ),
          }}
        >{prompt}</ReactMarkdown>
      </div>
    </div>
  );
}
