import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { WSProvider } from "./lib/ws";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WSProvider>
        <App />
      </WSProvider>
    </BrowserRouter>
  </StrictMode>,
);
