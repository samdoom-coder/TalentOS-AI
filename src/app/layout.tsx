import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HireAI — AI-Powered Interview Platform",
  description: "Streamline your recruitment process with AI-powered video interviews, automated resume screening, and intelligent candidate scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
