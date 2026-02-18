const SERIF = "'Spectral', Georgia, serif";

const FEATURES = [
  {
    title: "Reader View",
    description:
      "Threads, articles, and long posts rendered beautifully with a clean reading layout. No distractions.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.99 4H7V9h7.01V7zm3 4H7v2h10.01v-2zm-3 4H7v2h7.01v-2z" />
      </svg>
    ),
  },
  {
    title: "Reading Progress",
    description:
      "Pick up where you left off. Scroll position is saved automatically and restored when you return.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z" />
      </svg>
    ),
  },
  {
    title: "Themes",
    description:
      "Light, dark, or follow your system. Theme preference syncs across all your devices.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      </svg>
    ),
  },
  {
    title: "Keyboard Navigation",
    description:
      "Navigate with j/k, open with Enter, go back with Escape. Designed for power users.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
      </svg>
    ),
  },
  {
    title: "Daily Wallpapers",
    description:
      "Beautiful wallpapers refresh daily. Browse through the gallery or let it surprise you.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
      </svg>
    ),
  },
  {
    title: "Privacy First",
    description:
      "No tracking, no analytics, no server. Everything runs locally in your browser.",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    title: "Install",
    description: "Add the extension from the Chrome Web Store. One click.",
  },
  {
    title: "Browse X",
    description:
      "Visit x.com and bookmark posts you want to read later.",
  },
  {
    title: "Open a new tab",
    description:
      "Your bookmarks appear beautifully. Start reading.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-x-bg text-x-text">
      {/* Hero */}
      <header className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-x-border bg-x-card px-4 py-1.5 text-sm text-x-text-secondary">
          <svg
            viewBox="0 0 24 24"
            className="size-4 text-x-blue"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Chrome Extension
        </div>

        <h1
          className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          style={{ fontFamily: SERIF }}
        >
          Your bookmarks,
          <br />
          <span className="text-x-blue">beautifully.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-x-text-secondary">
          Replace your new tab with a calm reading space. X Bookmarks Tab
          surfaces your saved posts with reading progress, themes, and keyboard
          navigation &mdash; all without leaving your browser.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/demo"
            className="rounded-xl bg-x-blue px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try the Demo
          </a>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-x-border bg-x-card px-6 py-3 text-base font-semibold text-x-text transition-colors hover:bg-x-hover"
          >
            Add to Chrome &mdash; Free
          </a>
        </div>
      </header>

      {/* Preview */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-x-border bg-x-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-x-border px-4 py-3">
            <span className="size-3 rounded-full bg-red-400/80" />
            <span className="size-3 rounded-full bg-yellow-400/80" />
            <span className="size-3 rounded-full bg-green-400/80" />
            <span className="ml-4 flex-1 text-center text-xs text-x-text-secondary">
              New Tab
            </span>
          </div>
          <div className="relative aspect-[16/9] bg-stone-950">
            <img
              src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80"
              alt="Extension preview showing bookmark reader on new tab"
              className="h-full w-full object-cover opacity-50"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-[15%]">
              <p
                className="text-4xl font-light text-white/90 sm:text-5xl"
                style={{ fontFamily: SERIF }}
              >
                3:45 PM
              </p>
              <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400/70">
                  Pick up where you left off
                </p>
                <p
                  className="mt-2 text-sm text-white/80"
                  style={{ fontFamily: SERIF }}
                >
                  The Art of Simplicity in Software Design
                </p>
                <p className="mt-1 text-[11px] text-white/50">
                  @antirez &middot; saved 6 hours ago
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2
          className="mb-12 text-center text-3xl font-bold"
          style={{ fontFamily: SERIF }}
        >
          Everything you need to read more
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-x-border bg-x-card p-6"
            >
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-x-blue/10 text-x-blue">
                {f.icon}
              </span>
              <h3 className="text-lg font-semibold text-x-text">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-x-text-secondary">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <h2
          className="mb-12 text-center text-3xl font-bold"
          style={{ fontFamily: SERIF }}
        >
          Up and running in seconds
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-x-blue text-lg font-bold text-white">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold text-x-text">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-x-text-secondary">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="rounded-3xl border border-x-border bg-x-card p-10">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: SERIF }}
          >
            Ready to read better?
          </h2>
          <p className="mt-3 text-x-text-secondary">
            Free and open source. Your data stays in your browser.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/demo"
              className="rounded-xl bg-x-blue px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Try the Demo
            </a>
            <a
              href="https://chromewebstore.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-x-border px-6 py-3 text-base font-semibold text-x-text transition-colors hover:bg-x-hover"
            >
              Install Extension
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-x-border px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 text-sm text-x-text-secondary">
          <p>X Bookmarks Tab</p>
          <div className="flex gap-6">
            <a
              href="https://github.com"
              className="transition-colors hover:text-x-text"
            >
              GitHub
            </a>
            <a
              href="/demo"
              className="transition-colors hover:text-x-text"
            >
              Demo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
