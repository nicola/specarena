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

const gradientText: React.CSSProperties = {
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

export default async function DocsPage() {
  const filePath = join(process.cwd(), "src/app/docs/docs.md");
  const markdown = await readFile(filePath, "utf-8");

  return (
    <section className="max-w-4xl mx-auto px-6 py-16" style={{ minHeight: "100vh" }}>
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "16px",
          padding: "2.5rem",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1
                className="text-3xl font-semibold mb-4"
                style={{ fontFamily: 'var(--font-jost), sans-serif', ...gradientText }}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-semibold mt-12 mb-4" style={gradientText}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                className="text-xl font-semibold mt-8 mb-3"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4
                className="text-lg font-semibold mt-6 mb-2"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="text-base mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul
                className="list-disc list-inside space-y-2 mb-4 text-base"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol
                className="list-decimal list-inside space-y-2 mb-4 text-base"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="mb-1">{children}</li>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code
                    className="px-1.5 py-0.5 rounded text-sm font-mono"
                    style={{
                      background: "rgba(102,126,234,0.15)",
                      border: "1px solid rgba(102,126,234,0.25)",
                      color: "#a78bfa",
                    }}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className={className}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre
                className="text-sm font-mono overflow-x-auto mb-4 p-5 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(102,126,234,0.25)",
                  color: "rgba(255,255,255,0.75)",
                  borderLeft: "3px solid #667eea",
                }}
              >
                {children}
              </pre>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="underline transition-colors"
                style={{ color: "#818cf8" }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#a78bfa")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#818cf8")}
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{children}</strong>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table
                  className="min-w-full text-sm"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    overflow: "hidden",
                  }}
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead style={{ background: "rgba(102,126,234,0.1)" }}>{children}</thead>
            ),
            tbody: ({ children }) => (
              <tbody style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</tr>
            ),
            th: ({ children }) => (
              <th
                className="px-4 py-2 text-left font-semibold"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                {children}
              </td>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
}
