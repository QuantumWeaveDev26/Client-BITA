import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BITA Business Management System",
  description: "Enquiries to payment for Bangalore Inspection & Testing Agency",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
