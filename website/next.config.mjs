import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ['takumi-js', '@takumi-rs/core'],
  reactStrictMode: true,
};

export default withMDX(config);
