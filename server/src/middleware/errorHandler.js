// SFERA-PATCH:SPRINT2:errorHandler
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('❌ Error:', (err && err.stack) || err);
  const status = (err && (err.status || err.statusCode)) || 500;
  const code = (err && err.code) || 'INTERNAL_ERROR';
  const message = (err && err.message) || 'Internal Server Error';
  res.status(status).json({ success: false, code, message });
};

module.exports = errorHandler;
