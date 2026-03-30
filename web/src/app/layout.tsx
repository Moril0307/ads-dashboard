import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AdsDataHub",
  description: "Google Ads 聚合分析后台",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-white text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

