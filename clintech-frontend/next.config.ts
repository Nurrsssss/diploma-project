import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '185.125.46.62',
        port: '8800',
        pathname: '/public/**',
      },
      {
        protocol: 'https',
        hostname: '185.125.46.62',
        port: '8800',
        pathname: '/public/**',
      },
      // Добавляем поддержку для других возможных доменов
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8800',
        pathname: '/public/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '8800',
        pathname: '/public/**',
      },
    ],
  },
  serverExternalPackages: ['sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4gb',
    },
  },
  // Увеличиваем таймауты и лимиты для продакшн сервера
  httpAgentOptions: {
    keepAlive: true,
  },
  onDemandEntries: {
    maxInactiveAge: 300 * 1000,
    pagesBufferLength: 100,
  },
  // Настройки для улучшенной обработки ошибок загрузки chunks
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Добавляем обработку ошибок загрузки chunks на уровне webpack
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      };
    }
    return config;
  },
  // Настройки для кеширования и обработки статических файлов
  // generateBuildId удален - используем дефолтный детерминированный ID от Next.js
};

export default nextConfig;
