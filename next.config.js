/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        // Убрали COOP/COEP, чтобы Telegram SDK не блокировался CORP
        // { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        // { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
      ],
    },
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias['@tensorflow/tfjs-node'] = false;
      config.resolve.alias['fs'] = false;
    }
    return config;
  },
};

module.exports = nextConfig;
