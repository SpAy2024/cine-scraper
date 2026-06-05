require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const scraperService = require('./services/scraper.service');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api/v1/movies/search', async (req, res) => {
  const { q, year } = req.query;
  console.log(`🔍 SEARCH: q=${q}, year=${year}`);
  if (!q) return res.status(400).json({ error: 'Se requiere q' });
  
  try {
    const results = await scraperService.search(q, year);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/movies/info', async (req, res) => {
  const { url } = req.query;
  console.log(`📄 INFO: url=${url}`);
  if (!url) return res.status(400).json({ error: 'Se requiere url' });
  
  try {
    const data = await scraperService.getInfo(url);
    if (!data) return res.json({ success: false, error: 'No encontrado' });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor en http://0.0.0.0:${PORT}`);
});