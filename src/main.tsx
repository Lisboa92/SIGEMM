import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerServiceWorker";

// Registar o Service Worker para garantir operação offline e sincronização em segundo plano
registerServiceWorker().catch((err) => {
  console.warn("[SIGEMM] Registo do Service Worker:", err);
});

createRoot(document.getElementById("root")!).render(<App />);

