require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const scraperService = require('./services/scraper.service');
const { requireApiKey } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// Endpoints con API Key







// En index.js, asegúrate que la ruta /search use el scraper
app.get('/api/v1/movies/search', requireApiKey, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Se requiere q' });
  
  try {
    const results = await scraperService.search(q);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




app.get('/api/v1/movies/info', requireApiKey, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Se requiere url' });
  
  try {
    const data = await scraperService.getInfo(url);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/movies/episode', requireApiKey, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Se requiere url' });
  
  try {
    const data = await scraperService.getEpisodeInfo(url);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta pública
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor en http://0.0.0.0:${PORT}`);
});