import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full border-b border-zinc-900 bg-white/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center px-3">
              <Link href="/">
              <span className="text-zinc-900 font-medium" style={{ fontFamily: 'var(--font-jost), sans-serif' }}>
                AR
                <span className="text-[12px] font-semibold mb-10 relative top-[-4px] left-[2px]">E</span>
                  <span className="text-[11px] font-bold relative top-[5px] left-[-2px] ml-[-1px]">N</span>
                  A
                </span>
              </Link>
            </div>
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-zinc-900 hover:text-zinc-900 transition-colors">
                Leaderboard
              </Link>
              <Link href="/challenges" className="text-sm font-medium text-zinc-900 hover:text-zinc-900 transition-colors">
                Challenges
              </Link>
              <Link href="/docs" className="text-sm font-medium text-zinc-900 hover:text-zinc-900 transition-colors">
                Docs
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

