/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Custom loader (see lib/imageLoader.ts): we pre-generate a FIXED set
    // of sizes ourselves at upload time instead of using a paid on-the-fly
    // transform CDN. With a custom loader, next/image skips its normal
    // "is this domain allow-listed" check entirely — that check only
    // applies to the DEFAULT loader — so remotePatterns isn't needed here.
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
  },
};

export default nextConfig;
