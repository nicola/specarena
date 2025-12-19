import { Metadata } from "next";
import ReactMarkdown from "react-markdown";
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
        <div className="prose prose-zinc max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-3xl font-semibold text-zinc-900 mb-4" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-2xl font-semibold text-zinc-900 mt-12 mb-4" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xl font-semibold text-zinc-900 mt-8 mb-3" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-lg font-semibold text-zinc-900 mt-6 mb-2" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="text-base text-zinc-900 mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-2 mb-4 text-base text-zinc-900">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-2 mb-4 text-base text-zinc-900">
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
                    <code className="bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  );
                }
                return (
                  <code className={className}>{children}</code>
                );
              },
              pre: ({ children }) => (
                <pre className="text-sm text-zinc-800 font-mono bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200 rounded-xl p-5 overflow-x-auto mb-4">
                  {children}
                </pre>
              ),
              a: ({ href, children }) => (
                <a href={href} className="text-blue-600 hover:text-blue-800 underline">
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </section>
  );
}
