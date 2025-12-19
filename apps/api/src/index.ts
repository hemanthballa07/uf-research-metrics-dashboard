import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.API_PORT || 3001;

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
