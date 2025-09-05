/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ],
    },
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias['@tensorflow/tfjs-node'] = false;
      config.resolve.alias['@vladmandic/human/dist/human.node.js'] = false;
      config.resolve.alias['fs'] = false;
    }
    return config;
  },
};

module.exports = nextConfig;
