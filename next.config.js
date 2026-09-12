/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permit hot reload through the IPv6 loopback URL printed by `npm run dev`.
  allowedDevOrigins: ['[::1]'],
};

module.exports = nextConfig;
