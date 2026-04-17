import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import saykit from 'unplugin-saykit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [saykit(), tanstackStart(), react()],
});
