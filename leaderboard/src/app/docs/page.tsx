import { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readFile } from "fs/promises";
import { join } from "path";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `Academic Oracle — Documentation`,
    description: "Learn how to participate in the Academic Oracle and compete in challenges.",
  };
  return metadata;
}

export default async function DocsPage() {
  const filePath = join(process.cwd(), "src/app/docs/docs.md");
  const markdown = await readFile(filePath, "utf-8");

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      {/* Page header */}
      <div style={{ borderLeft: '4px solid #1a3a5c', paddingLeft: '1.5rem', marginBottom: '3rem' }}>
        <p style={{
          fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
          fontSize: '0.65rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#b8860b',
          marginBottom: '0.4rem',
        }}>
          Academic Oracle
        </p>
        <h1 style={{
          fontFamily: 'var(--font-eb-garamond), Georgia, serif',
          fontSize: '2rem',
          fontWeight: 600,
          color: '#1a3a5c',
          lineHeight: 1.25,
        }}>
          Participant Guide
        </h1>
      </div>

      {/* Document body */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4c9b0',
        borderLeft: '4px solid #1a3a5c',
        padding: '2rem 2.5rem',
      }}>
        <div style={{
          fontFamily: 'var(--font-eb-garamond), Georgia, serif',
          fontSize: '1.0625rem',
          lineHeight: '1.85',
          color: '#2c2c2c',
        }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 style={{
                  fontFamily: 'var(--font-eb-garamond), Georgia, serif',
                  fontSize: '1.625rem',
                  fontWeight: 600,
                  color: '#1a3a5c',
                  marginTop: '2rem',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.4rem',
                  borderBottom: '1px solid #d4c9b0',
                  lineHeight: 1.3,
                }}>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 style={{
                  fontFamily: 'var(--font-eb-garamond), Georgia, serif',
                  fontSize: '1.375rem',
                  fontWeight: 600,
                  color: '#1a3a5c',
                  marginTop: '2.5rem',
                  marginBottom: '0.6rem',
                  paddingBottom: '0.3rem',
                  borderBottom: '1px solid #e8e0d0',
                  lineHeight: 1.3,
                }}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 style={{
                  fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
                  fontSize: '0.75rem',
                  fontVariant: 'small-caps',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#6b5a44',
                  marginTop: '1.75rem',
                  marginBottom: '0.5rem',
                }}>
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 style={{
                  fontFamily: 'var(--font-ibm-plex-sans), sans-serif',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#1a3a5c',
                  marginTop: '1.25rem',
                  marginBottom: '0.35rem',
                }}>
                  {children}
                </h4>
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
                      padding: '0.1em 0.4em',
                      border: '1px solid #d4c9b0',
                    }}>
                      {children}
                    </code>
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
                }}>
                  {children}
                </pre>
              ),
              a: ({ href, children }) => (
                <a href={href} style={{ color: '#1a3a5c', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600, color: '#1a3a5c' }}>{children}</strong>
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
              tbody: ({ children }) => (
                <tbody style={{ borderTop: 0 }}>{children}</tbody>
              ),
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
                }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td style={{ padding: '0.5rem 0.9rem', color: '#2c2c2c' }}>{children}</td>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
