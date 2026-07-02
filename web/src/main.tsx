import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WSProvider } from "./lib/ws";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WSProvider>
      <App />
    </WSProvider>
  </StrictMode>,
);
