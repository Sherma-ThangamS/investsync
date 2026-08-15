import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./components/auth-provider";

export const metadata: Metadata = {
  title: "CopyTrade — Copy Trading Platform",
  description:
    "Simulation-only copy-trading platform. Follow master traders, mirror strategies, and manage risk — all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
