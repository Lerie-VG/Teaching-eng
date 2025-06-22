import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cambridge CAE/CPE Writing Analyzer",
  description: "Analyze your Cambridge exam writing using official marking criteria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
