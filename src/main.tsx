import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { ThemeProvider } from "./components/ThemeProvider";
import { applyCrmBackground, getCrmBackground } from "./lib/background";
import { applyCrmStyle, getCrmStyle } from "./lib/style";

applyCrmBackground(getCrmBackground());
applyCrmStyle(getCrmStyle());

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    <App />
  </ThemeProvider>
);
