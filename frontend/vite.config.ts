import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // Path resolution (mirrors tsconfig paths)
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      // Maintain baseUrl "./src" from tsconfig
      components: path.resolve(__dirname, 'src/components'),
      contexts: path.resolve(__dirname, 'src/contexts'),
      services: path.resolve(__dirname, 'src/services'),
      utils: path.resolve(__dirname, 'src/utils'),
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true
      }
    }
  },

  // Build configuration
  build: {
    outDir: 'build', // Keep same output directory as CRA
    sourcemap: true,
  },

  // CSS handling
  css: {
    preprocessorOptions: {
      scss: {
        charset: false
      }
    }
  }
})
