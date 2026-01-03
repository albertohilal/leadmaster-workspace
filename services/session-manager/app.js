import express from 'express';
import healthRouter from './routes/health.js';
import statusRouter from './routes/status.js';
import sendRouter from './routes/send.js';
import qrRouter from './routes/qr.js';

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/status', statusRouter);
app.use('/send', sendRouter);
app.use('/qr', qrRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    code: 'NOT_FOUND',
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Express] Error:', err);
  res.status(500).json({
    error: true,
    code: 'INTERNAL_ERROR',
    message: err.message || 'Internal server error'
  });
});

export default app;
