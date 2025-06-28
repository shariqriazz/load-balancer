/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Allow cross-origin requests for API endpoints
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Profile',
          },
        ],
      },
    ];
  },
  
  // Configure allowed dev origins
  allowedDevOrigins: [
    'gemini.gawdofai.com',
    'localhost',
    '127.0.0.1',
  ],
};

module.exports = nextConfig;