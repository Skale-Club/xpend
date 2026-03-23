import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth/AuthGate";
import { ToastProvider } from "@/components/ui";
import { ChatWidget } from "@/components/chat";
import { SensitiveValuesProvider } from "@/components/layout/SensitiveValuesProvider";
import { PWARegister } from "@/components/pwa/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Xpend",
  title: "Xpend",
  description: "Track your spending across multiple accounts",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Xpend",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
        style={{ backgroundColor: "#f9fafb" }}
        suppressHydrationWarning
      >
        <ToastProvider>
          <SensitiveValuesProvider>
            <AuthGate>{children}</AuthGate>
            <ChatWidget />
            <PWARegister />
          </SensitiveValuesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
