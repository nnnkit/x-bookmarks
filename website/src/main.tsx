import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LandingPage from "./landing/LandingPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
