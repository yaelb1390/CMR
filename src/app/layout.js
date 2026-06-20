import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "CRM - Préstamos BM",
  description: "Sistema de administración de préstamos integrado con WhatsApp",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>
          <AppShell>
            {children}
          </AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
