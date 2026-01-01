import express from 'express';
import statusRouter from './routes/status.js';
import qrRouter from './routes/qr.js';
import sendRouter from './routes/send.js';
import disconnectRouter from './routes/disconnect.js';
import accountRouter from './routes/account.js';
import healthRouter from './routes/health.js';

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/status', statusRouter);
app.use('/qr-code', qrRouter);
app.use('/send', sendRouter);
app.use('/disconnect', disconnectRouter);
app.use('/account-info', accountRouter);
app.use('/health', healthRouter);

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
