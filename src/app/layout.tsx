import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrapeNote — 포도알 진도카드",
  description: "연습 영상을 올리고 포도알을 채우는 온라인 악기 연습 진도 카드",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-violet-50/40 text-gray-900">
        {children}
      </body>
    </html>
  );
}
