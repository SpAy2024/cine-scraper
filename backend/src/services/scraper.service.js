const axios = require('axios');
const cheerio = require('cheerio');
const multiProvider = require('./multi-provider.service');

const TMDB_API_KEY = 'e416234abcb5d260538a8f7ce6ba12e4';
const TMDB_BASE = 'https://api.themoviedb.org/3';

class ScraperService {
  
  async searchCinecalidad(query) {
    const domains = ['https://www.cinecalidad.ec', 'https://www.cinecalidad.rs', 'https://cinecalidad.onl'];
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const domain of domains) {
      try {
        const searchUrl = `${domain}/?s=${encodeURIComponent(query)}`;
        console.log(`🔍 Buscando en ${domain}`);
        const response = await axios.get(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 15000
        });
        const $ = cheerio.load(response.data);
        
        $('a[href*="/ver-pelicula/"], a[href*="/pelicula/"], a[href*="/series/"], a[href*="/animes/"]').each((i, el) => {
          const url = $(el).attr('href');
          let title = $(el).find('h3, .title').text().trim();
          if (!title) title = $(el).text().trim();
          
          if (title && title.toLowerCase().includes(queryLower)) {
            results.push({
              id: null,
              title: title,
              url: url,
              thumbnail: $(el).find('img').attr('src'),
              provider: 'cinecalidad'
            });
          }
        });
        if (results.length > 0) break;
      } catch (error) {
        console.log(`Error en ${domain}:`, error.message);
      }
    }
    return results;
  }
  
  async search(query) {
    console.log(`🔍 Buscando: "${query}"`);
    const results = await this.searchCinecalidad(query);
    return results;
  }
  
  async getInfo(url) {
    // Si es URL de Cinecalidad
    if (url.includes('cinecalidad')) {
      return await this.getCinecalidadInfo(url);
    }
    
    // Para otras URLs, usar multi-proveedor
    const title = this.extractTitleFromUrl(url);
    const servers = await multiProvider.buscarServidoresPorTitulo(title);
    
    return {
      title: title,
      synopsis: 'Sinopsis no disponible',
      url: url,
      provider: 'multiprovider',
      downloadLinks: servers
    };
  }
  
  async getCinecalidadInfo(url) {
    try {
      console.log(`📄 Obteniendo info de: ${url}`);
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      const title = $('h1').first().text().trim() || 'Sin título';
      const downloadLinks = [];
      
      $('#playeroptionsul .dooplay_player_option').each((i, el) => {
        const dataOption = $(el).attr('data-option');
        const serverName = $(el).text().trim().replace(/Recomendado$/, '').trim();
        if (dataOption && dataOption !== '#') {
          const match = dataOption.match(/zopass=([^&]+)/);
          if (match && match[1]) {
            const decodedUrl = Buffer.from(match[1], 'base64').toString('utf-8');
            downloadLinks.push({ server: serverName, url: decodedUrl });
          }
        }
      });
      
      return { title, downloadLinks };
    } catch (error) {
      return null;
    }
  }
  
  extractTitleFromUrl(url) {
    const match = url.match(/\/(?:pelicula|ver-pelicula)\/([^\/]+)/);
    if (match) {
      return match[1].replace(/-/g, ' ');
    }
    return '';
  }
}

module.exports = new ScraperService();