import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { StoreProvider } from "./context/StoreContext.jsx";
import { SystemSettingsProvider } from "./context/SystemSettingsContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import "./styles/global.css";
import "./styles/kucur-redesign.css";
import "./styles/design-system.css";
import "./styles/form-system.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PreferencesProvider>
    <AuthProvider>
      <SystemSettingsProvider>
        <StoreProvider>
          <NotificationProvider>
            <ChatProvider>
              <App />
            </ChatProvider>
          </NotificationProvider>
        </StoreProvider>
      </SystemSettingsProvider>
    </AuthProvider>
    </PreferencesProvider>
  </StrictMode>
);
