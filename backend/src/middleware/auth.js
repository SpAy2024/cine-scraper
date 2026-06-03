// middleware/auth.js
function requireApiKey(req, res, next) {
  // Omitir en desarrollo local si no hay API_KEY
  if (process.env.NODE_ENV !== 'production' && !process.env.API_KEY) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'Se requiere API Key. Envíala en el header x-api-key'
    });
  }
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ 
      success: false, 
      error: 'API Key inválida'
    });
  }
  
  next();
}

module.exports = { requireApiKey };