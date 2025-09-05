/** @type {import('next').NextConfig} */
const path = require('path');
const fs = require('fs');

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
    // Resolve absolute path to package.json, then join to dist/human.esm.js
    const humanPkg = require.resolve('@vladmandic/human/package.json');
    const humanEsm = path.join(humanPkg, '..', 'dist', 'human.esm.js');
    if (!fs.existsSync(humanEsm)) {
      throw new Error('Cannot find Human ESM at: ' + humanEsm);
    }
    // Exact-match alias to the package root
    config.resolve.alias['@vladmandic/human$'] = humanEsm;

    if (!isServer) {
      config.resolve.alias['@tensorflow/tfjs-node'] = false;
      config.resolve.alias['@vladmandic/human/dist/human.node.js'] = false;
      config.resolve.alias['fs'] = false;
    }
    return config;
  },
};

module.exports = nextConfig;
