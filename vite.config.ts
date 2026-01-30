import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        nodePolyfills({
          // Enable polyfills for Node.js modules used by @inco/solana-sdk
          include: ['buffer', 'crypto', 'stream', 'util', 'process', 'events', 'string_decoder', 'vm'],
          globals: {
            Buffer: true,
            global: true,
            process: true,
          },
          // Use crypto-browserify for full crypto support including createHash
          overrides: {
            crypto: 'crypto-browserify',
          },
          protocolImports: true,
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'global': 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'crypto': 'crypto-browserify',
          'stream': 'stream-browserify',
        },
      },
      optimizeDeps: {
        include: ['crypto-browserify', 'buffer', '@solana/web3.js', 'stream-browserify'],
        esbuildOptions: {
          define: {
            global: 'globalThis',
          },
        },
      },
      build: {
        commonjsOptions: {
          transformMixedEsModules: true,
        },
      },
    };
});
