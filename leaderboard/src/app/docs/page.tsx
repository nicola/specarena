import { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readFile } from "fs/promises";
import { join } from "path";

export async function generateMetadata() {
  const metadata: Metadata = {
    title: `ARENA - Documentation`,
    description: "Learn how to participate in the Multi-Agent Arena and compete in challenges.",
  };
  return metadata;
}

export default async function DocsPage() {
  const filePath = join(process.cwd(), "src/app/docs/docs.md");
  const markdown = await readFile(filePath, "utf-8");

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <div className="max-w-none" style={{ fontFamily: 'var(--font-share-tech-mono), monospace' }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1
                className="text-3xl font-semibold mb-6"
                style={{
                  fontFamily: 'var(--font-orbitron), Orbitron, sans-serif',
                  color: '#00ffff',
                  textShadow: '0 0 20px #00ffff, 0 0 40px #00ffff66',
                }}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                className="text-2xl font-semibold mt-12 mb-4"
                style={{
                  fontFamily: 'var(--font-orbitron), Orbitron, sans-serif',
                  color: '#00ffff',
                  textShadow: '0 0 10px #00ffff66',
                  borderBottom: '1px solid #00ffff33',
                  paddingBottom: '0.5rem',
                }}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                className="text-xl font-semibold mt-8 mb-3"
                style={{
                  fontFamily: 'var(--font-orbitron), Orbitron, sans-serif',
                  color: '#00ffff99',
                }}
              >
                &gt; {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4
                className="text-lg font-semibold mt-6 mb-2"
                style={{ color: '#00ffff77', fontFamily: 'var(--font-share-tech-mono), monospace' }}
              >
                // {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="text-base text-zinc-300 mb-4" style={{ lineHeight: '1.7' }}>
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-none space-y-2 mb-4 text-base text-zinc-300">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-none space-y-2 mb-4 text-base text-zinc-300 counter-reset-item">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="pl-4 before:content-['>'] before:text-[#00ff41] before:mr-2 text-zinc-300">{children}</li>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code
                    className="text-[#00ff41] px-1.5 py-0.5 text-sm font-mono"
                    style={{ background: '#001a0a', border: '1px solid #00ff4133' }}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={`${className} text-[#00ff41]`}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre
                className="text-sm text-[#00ff41] font-mono p-5 overflow-x-auto mb-4"
                style={{
                  background: '#001a0a',
                  border: '1px solid #00ff4144',
                  boxShadow: '0 0 10px #00ff4111',
                }}
              >
                {children}
              </pre>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-[#00ffff] underline hover:text-white transition-colors"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="text-white font-semibold">{children}</strong>
            ),
            blockquote: ({ children }) => (
              <blockquote
                className="border-l-2 border-[#ff0090] pl-4 text-zinc-400 italic my-4"
                style={{ background: '#ff009008' }}
              >
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table
                  className="min-w-full text-sm"
                  style={{ border: '1px solid #00ffff44' }}
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead style={{ background: '#00ffff11', borderBottom: '1px solid #00ffff44' }}>{children}</thead>
            ),
            tbody: ({ children }) => (
              <tbody>{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr style={{ borderBottom: '1px solid #00ffff11' }}>{children}</tr>
            ),
            th: ({ children }) => (
              <th
                className="px-4 py-2 text-left font-semibold text-[#00ffff]"
                style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif', fontSize: '0.7rem', letterSpacing: '0.05em' }}
              >
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-2 text-zinc-300">{children}</td>
            ),
            hr: () => (
              <hr style={{ border: 'none', borderTop: '1px solid #00ffff22', margin: '2rem 0' }} />
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
}
