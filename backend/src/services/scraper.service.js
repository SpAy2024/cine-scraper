const axios = require('axios');
const cheerio = require('cheerio');

const TMDB_API_KEY = 'e416234abcb5d260538a8f7ce6ba12e4';
const TMDB_BASE = 'https://api.themoviedb.org/3';

class ScraperService {
  
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
  
  // ==================== PELISFLIX1.QUEST ====================
 async searchPelisflix(query) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  try {
    const searchUrl = `https://pelisflix1.quest/?s=${encodeURIComponent(query)}`;
    console.log(`🔍 Buscando en Pelisflix: ${searchUrl}`);
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    
    // Buscar películas
    $('a[href*="/pelicula/"]').each((i, el) => {
      let url = $(el).attr('href');
      let title = $(el).find('h3, .title, .entry-title').text().trim();
      if (!title) title = $(el).text().trim();
      
      // Completar URL relativa
      if (url && url.startsWith('/')) {
        url = `https://pelisflix1.quest${url}`;
      }
      
      if (title && title.toLowerCase().includes(queryLower)) {
        results.push({
          id: null,
          title: title,
          url: url,
          thumbnail: $(el).find('img').attr('src'),
          provider: 'pelisflix',
          type: 'movie'
        });
      }
    });
    
    // Buscar episodios
    $('a[href*="/episodio/"]').each((i, el) => {
      let url = $(el).attr('href');
      let title = $(el).find('h3, .title, .entry-title').text().trim();
      if (!title) title = $(el).text().trim();
      
      if (url && url.startsWith('/')) {
        url = `https://pelisflix1.quest${url}`;
      }
      
      if (title && title.toLowerCase().includes(queryLower)) {
        results.push({
          id: null,
          title: title,
          url: url,
          thumbnail: $(el).find('img').attr('src'),
          provider: 'pelisflix',
          type: 'episode'
        });
      }
    });
    
    // Eliminar duplicados por URL
    const uniqueResults = [];
    const seenUrls = new Set();
    for (const result of results) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        uniqueResults.push(result);
      }
    }
    
    console.log(`✅ Pelisflix: ${uniqueResults.length} resultados`);
    return uniqueResults;
  } catch (error) {
    console.log('Error en Pelisflix:', error.message);
    return [];
  }
}
  
  // ==================== BÚSQUEDA COMBINADA ====================
  async search(query) {
    console.log(`🔍 Buscando: "${query}"`);
    
    // Buscar en Pelisflix
    const pelisflixResults = await this.searchPelisflix(query);
    if (pelisflixResults.length > 0) {
      console.log(`✅ ${pelisflixResults.length} resultados de Pelisflix`);
      return pelisflixResults;
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
    // Detectar episodio
    if (url.includes('/episodio/')) {
      console.log(`🎬 Detectado como episodio: ${url}`);
      return await this.getEpisodeInfo(url);
    }
    
    // Detectar Pelisflix
    if (url.includes('pelisflix1.quest')) {
      console.log(`🎬 Detectado como Pelisflix: ${url}`);
      return await this.getPelisflixInfo(url);
    }
    
    return null;
  }
  
  // ==================== PELISFLIX INFO ====================
async getPelisflixInfo(url) {
  try {
    console.log(`📄 Obteniendo info de Pelisflix: ${url}`);
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    
    // Título
    const title = $('h1').first().text().trim() || 'Sin título';
    
    // Año
    let year = null;
    $('.year, .date').each((i, el) => {
      const match = $(el).text().match(/\b(19|20)\d{2}\b/);
      if (match) year = match[0];
    });
    
    // Sinopsis
    let synopsis = '';
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 200 && !text.includes('Ver') && !text.includes('Recuerda')) {
        synopsis = text;
        return false;
      }
    });
    
    // Poster
    let poster = $('.TPostBg, img').first().attr('src');
    if (poster && poster.startsWith('//')) poster = 'https:' + poster;
    
    // ==================== SERVIDORES ====================
    const downloadLinks = [];
    
    // Buscar divs con data-url (en base64)
    // Dentro de getPelisflixInfo, mejora la extracción de servidores:
$('[data-url]').each((i, el) => {
  const dataUrl = $(el).attr('data-url');
  
  // Limpiar nombre del servidor
  let serverName = $(el).find('.nmopt').first().text().trim();
  const idiomaSpan = $(el).find('span').last().text().trim();
  const calidad = idiomaSpan.match(/HD|4K|1080p|720p/i)?.[0] || 'HD';
  
  if (!serverName) {
    serverName = `${idioma} - Calidad ${calidad}`;
  }
  
  if (dataUrl && dataUrl !== '#') {
    try {
      const decodedUrl = Buffer.from(dataUrl, 'base64').toString('utf-8');
      downloadLinks.push({
        server: serverName,
        url: decodedUrl,
        type: 'iframe',
        quality: calidad
      });
    } catch(e) {}
  }
});
    
    // También buscar iframes como fallback
    if (downloadLinks.length === 0) {
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
    }
    
    console.log(`✅ Pelisflix: ${downloadLinks.length} servidores encontrados`);
    
    return {
      title: title,
      synopsis: synopsis.substring(0, 500) || 'Sinopsis no disponible',
      year: year,
      url: url,
      provider: 'pelisflix',
      poster: poster,
      downloadLinks: downloadLinks,
      type: url.includes('/episodio/') ? 'episode' : 'movie'
    };
  } catch (error) {
    console.error('Error en getPelisflixInfo:', error.message);
    return null;
  }
}
  // ==================== EPISODIOS ====================
  async getEpisodeInfo(episodeUrl) {
    try {
      console.log(`📄 Obteniendo episodio de: ${episodeUrl}`);
      const response = await axios.get(episodeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      // Título del episodio
      const title = $('h1').first().text().trim() || 'Episodio';
      
      // Servidores del episodio
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
      
      console.log(`✅ ${downloadLinks.length} servidores encontrados para el episodio`);
      
      return {
        title: title,
        downloadLinks: downloadLinks,
        episodes: []
      };
    } catch (error) {
      console.error('Error en getEpisodeInfo:', error.message);
      return null;
    }
  }
}

module.exports = new ScraperService();