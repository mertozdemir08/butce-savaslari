import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // Motor ve sunucu testleri node'da kosar. Bilesen testleri DOM ister ve
    // bunu dosya basindaki "@vitest-environment jsdom" docblock'u ile soyler.
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
