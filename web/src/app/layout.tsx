
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "在线文档",
  description: "在线文档",
};
import { Suspense } from 'react'
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Suspense fallback={<div>Loading...</div>}>   {children}</Suspense>
      </body>
    </html>
  );
}
