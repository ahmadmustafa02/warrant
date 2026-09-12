import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep AGENTS.md as the project’s own working agreements, not Next’s generated file.
  agentRules: false,
};

export default nextConfig;
