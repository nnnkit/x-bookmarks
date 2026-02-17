interface OnboardingProps {
  phase: "need_login" | "connecting";
}

export function Onboarding({ phase }: OnboardingProps) {
  if (phase === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-x-bg text-x-text">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-x-blue mb-6" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <div className="w-8 h-8 border-2 border-x-blue border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-bold">Connecting to X...</p>
        <p className="text-x-text-secondary text-sm mt-2">
          Syncing your session in the background.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-x-bg text-x-text">
      <svg viewBox="0 0 24 24" className="w-14 h-14 text-x-blue mb-8" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>

      <h1 className="text-2xl font-bold mb-2">Your bookmarks, beautifully.</h1>
      <p className="text-x-text-secondary text-lg mb-8 max-w-sm text-center">
        Read your saved posts in a clean, distraction-free view.
      </p>

      <a
        href="https://x.com/login"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-x-blue hover:bg-x-blue/90 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors"
      >
        Log in to X
      </a>

      <p className="text-x-text-secondary text-sm mt-4">
        Already logged in? Just open a new tab.
      </p>
    </div>
  );
}
