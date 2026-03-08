import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth/AuthGate";
import { ToastProvider } from "@/components/ui";
import { ChatWidget } from "@/components/chat";
import { SensitiveValuesProvider } from "@/components/layout/SensitiveValuesProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Xpend",
  description: "Track your spending across multiple accounts",
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
        style={{ backgroundColor: '#f9fafb' }}
        suppressHydrationWarning
      >
        <ToastProvider>
          <SensitiveValuesProvider>
            <AuthGate>{children}</AuthGate>
            <ChatWidget />
          </SensitiveValuesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
