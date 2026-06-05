const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const TMDB_API_KEY = 'e416234abcb5d260538a8f7ce6ba12e4';
const TMDB_BASE = 'https://api.themoviedb.org/3';

class ScraperService {
  constructor() {
    this.browser = null;
  }
  
  async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }
  
  // ==================== TMDB ====================
  async searchTMDB(query, type = 'movie') {
    try {
      let endpoint = `${TMDB_BASE}/search/movie`;
      if (type === 'tv') endpoint = `${TMDB_BASE}/search/tv`;
      
      const response = await axios.get(endpoint, {
        params: {
          api_key: TMDB_API_KEY,
          query: query,
          language: 'es',
          include_adult: false
        }
      });
      
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results.slice(0, 10).map(item => ({
          id: item.id,
          title: item.title || item.name,
          originalTitle: item.original_title || item.original_name,
          year: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : null),
          overview: item.overview,
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
          voteAverage: item.vote_average,
          provider: 'tmdb',
          type: type
        }));
      }
      return [];
    } catch (error) {
      console.error('Error en searchTMDB:', error.message);
      return [];
    }
  }
  
  // ==================== LAMOVIE ====================
  async searchLamovie(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    try {
      // Construir slug para URL directa
      const slug = queryLower
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // URL correcta de Lamovie (con /peliculas/ no /movies/)
      const url = `https://lamovie.org/peliculas/${slug}/`;
      console.log(`🔍 Probando URL directa: ${url}`);
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });
      
      if (response.status === 200) {
        const $ = cheerio.load(response.data);
        const title = $('h1').first().text().trim();
        
        if (title) {
          results.push({
            id: null,
            title: title,
            url: url,
            thumbnail: null,
            provider: 'lamovie',
            type: 'movie'
          });
          console.log(`✅ Encontrada: ${title}`);
          return results;
        }
      }
    } catch (error) {
      console.log('Error en Lamovie:', error.message);
    }
    
    return results;
  }
  
  // ==================== BÚSQUEDA COMBINADA ====================
  async search(query) {
    console.log(`🔍 Buscando: "${query}"`);
    
    // Buscar en Lamovie
    const lamovieResults = await this.searchLamovie(query);
    if (lamovieResults.length > 0) {
      console.log(`✅ ${lamovieResults.length} resultados de Lamovie`);
      return lamovieResults;
    }
    
    // Si no hay resultados, buscar en TMDB
    const tmdbMovies = await this.searchTMDB(query, 'movie');
    const tmdbSeries = await this.searchTMDB(query, 'tv');
    const allTmdb = [...tmdbMovies, ...tmdbSeries];
    
    return allTmdb.map(tm => ({
      id: tm.id,
      title: tm.title,
      year: tm.year,
      url: null,
      thumbnail: tm.poster,
      provider: 'tmdb',
      type: tm.type === 'tv' ? 'serie' : 'movie'
    }));
  }
  
  // ==================== OBTENER INFORMACIÓN ====================
  async getInfo(url) {
    if (url.includes('lamovie.org')) {
      console.log(`🎬 Detectado como Lamovie: ${url}`);
      return await this.getLamovieInfo(url);
    }
    return null;
  }
  
  // ==================== LAMOVIE INFO (CON PUPPETEER) ====================
  async getLamovieInfo(url) {
  try {
    console.log(`📄 Obteniendo info de Lamovie: ${url}`);
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    
    // Título
    const title = $('h1').first().text().trim() || 'Sin título';
    
    // Año
    let year = null;
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) year = yearMatch[0];
    
    // Sinopsis
    let synopsis = '';
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 100 && !text.includes('Ver')) {
        synopsis = text;
        return false;
      }
    });
    
    // Poster
    let poster = null;
    const bgStyle = $('.--player-bg').attr('style');
    if (bgStyle) {
      const match = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) poster = match[1];
    }
    
    // Servidores - buscar iframes
    const downloadLinks = [];
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('http')) {
        downloadLinks.push({
          server: `Servidor ${i+1}`,
          url: src,
          type: 'iframe'
        });
      }
    });
    
    // Buscar data-video
    $('[data-video]').each((i, el) => {
      const videoUrl = $(el).attr('data-video');
      if (videoUrl && videoUrl.startsWith('http')) {
        downloadLinks.push({
          server: `Servidor ${i+1}`,
          url: videoUrl,
          type: 'iframe'
        });
      }
    });
    
    console.log(`✅ Lamovie: ${downloadLinks.length} servidores encontrados`);
    
    return {
      title: title,
      synopsis: synopsis.substring(0, 500) || 'Sinopsis no disponible',
      year: year,
      url: url,
      provider: 'lamovie',
      poster: poster,
      downloadLinks: downloadLinks,
      type: 'movie'
    };
  } catch (error) {
    console.error('Error en getLamovieInfo:', error.message);
    return null;
  }
}


}

module.exports = new ScraperService();