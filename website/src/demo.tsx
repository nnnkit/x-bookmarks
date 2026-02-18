// Side-effect: installs chrome polyfill + seeds wallpaper cache.
// Must be the FIRST import so the polyfill is in place before any
// extension module evaluates.
import "./mock/setup";

import { seedDatabase } from "./mock/seed-db";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@ext/components/ErrorBoundary";
import DemoApp from "./demo/DemoApp";
import "./index.css";

async function main() {
  await seedDatabase();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <DemoApp />
      </ErrorBoundary>
    </StrictMode>,
  );
}

main();
