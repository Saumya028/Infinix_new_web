/** @type {import('next').NextConfig} */
const nextConfig = {
  // In Step 6 (image pipeline) we'll add `images.remotePatterns` here to
  // allow next/image to load from our CDN/storage domain. Left minimal
  // for now since we're still using placeholder image URLs.
  reactStrictMode: true,
};

export default nextConfig;
