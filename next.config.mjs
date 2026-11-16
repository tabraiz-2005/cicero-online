/** @type {import('next').NextConfig} */
const nextConfig = {
  // On your computer, /api/* goes to the Python server on port 8000.
  // On Vercel, /api/* goes to the Python serverless function (api/index.py).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.VERCEL ? "/api/" : "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
