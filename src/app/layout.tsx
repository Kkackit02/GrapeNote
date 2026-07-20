import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrapeNote — 포도알 진도카드",
  description: "연습 영상을 올리고 포도알을 채우는 온라인 악기 연습 진도 카드",
  // 홈 화면에 추가(PWA) — 알림은 설치된 상태여야 iOS에서 동작한다
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GrapeNote" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3aed",
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
