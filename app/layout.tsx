import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth For Impact — Resume Screening & Ranking Prototype",
  description: "AI & Rubric-driven resume screening and ranking prototype for LCA Consultant and UI/UX Designer roles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
