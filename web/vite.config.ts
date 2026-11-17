import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// dev: POST /field, /farm and GET /template go to the API (pipeline/api.py on :8000); in production the API serves the site itself
export default defineConfig({ plugins: [react()], server: { proxy: { '/field': 'http://localhost:8000', '/farm': 'http://localhost:8000', '/template': 'http://localhost:8000' } } })
