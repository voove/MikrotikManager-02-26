import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MikroTik Manager",
  description: "Remote LTE Router Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
