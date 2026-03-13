import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  fallbacks: {
    document: "/~offline",
  },
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // トップページ: キャッシュ即返し + 裏で更新
        urlPattern: /^https?:\/\/[^/]+\/$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "start-url",
          expiration: { maxEntries: 1, maxAgeSeconds: 86400 },
        },
      },
      {
        // ページナビゲーション（RSC）: キャッシュ即返し + 裏で更新
        urlPattern: ({ request, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) => {
          return request.headers.get("RSC") === "1" && sameOrigin
        },
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pages-rsc",
          expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
        },
      },
      {
        // 通常ページ: キャッシュ即返し + 裏で更新
        urlPattern: ({ url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) => {
          return sameOrigin && !url.pathname.startsWith("/api/")
        },
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pages",
          expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@react-pdf/layout',
    '@react-pdf/pdfkit',
    '@react-pdf/primitives',
    '@react-pdf/font',
    '@react-pdf/fns',
    '@react-pdf/image',
    '@react-pdf/stylesheet',
    '@react-pdf/textkit',
    '@react-pdf/types',
  ],
};

export default withPWA(nextConfig);
