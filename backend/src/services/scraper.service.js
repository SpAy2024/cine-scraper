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
  
  // ==================== POSEIDONHD2 ====================ohohhhhhhhhhhhhhh
// ==================== POSEIDONHD2 ====================
async searchPoseidon(query) {
  const results = [];
  
  try {
    // 1. PRIMERO: Buscar en TMDB para obtener el ID y título
    const tmdbResults = await this.searchTMDB(query);
    
    if (tmdbResults.length === 0) {
      console.log(`❌ No se encontró en TMDB: ${query}`);
      return [];
    }
    
    // 2. Para cada resultado de TMDB, intentar construir URL de Poseidon
    for (const tmdb of tmdbResults) {
      // Probar diferentes formatos de URL
      const urlsToTry = [
        `https://www.poseidonhd2.co/pelicula/${tmdb.id}`,
        `https://www.poseidonhd2.co/pelicula/${tmdb.id}/${tmdb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        `https://www.poseidonhd2.co/pelicula/${tmdb.id}/${tmdb.originalTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || ''}`
      ];
      
      for (const url of urlsToTry) {
        try {
          console.log(`🔍 Probando URL: ${url}`);
          const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
          });
          
          if (response.status === 200) {
            const $ = cheerio.load(response.data);
            const title = $('h1').first().text().trim();
            if (title) {
              results.push({
                id: tmdb.id,
                title: title,
                url: url,
                thumbnail: tmdb.poster,
                provider: 'poseidon',
                type: 'movie',
                year: tmdb.year
              });
              console.log(`✅ Encontrada: ${title} -> ${url}`);
              return results; // Devolver el primero que encuentre
            }
          }
        } catch(e) {
          console.log(`❌ URL no válida: ${url}`);
        }
      }
    }
    
    console.log(`✅ Poseidon: ${results.length} resultados`);
    return results;
  } catch (error) {
    console.log('Error en Poseidon:', error.message);
    return [];
  }
}
  
  // ==================== BÚSQUEDA COMBINADA ====================
// ==================== BÚSQUEDA COMBINADA ====================
async search(query) {
  console.log(`🔍 Buscando: "${query}"`);
  
  // Buscar en PoseidonHD2 (usa TMDB internamente)
  const poseidonResults = await this.searchPoseidon(query);
  if (poseidonResults.length > 0) {
    console.log(`✅ ${poseidonResults.length} resultados de PoseidonHD2`);
    return poseidonResults;
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
    
    // Detectar PoseidonHD2
    if (url.includes('poseidonhd2.co')) {
      console.log(`🎬 Detectado como PoseidonHD2: ${url}`);
      return await this.getPoseidonInfo(url);
    }
    
    return null;
  }
  
  // ==================== POSEIDON INFO ====================
  async getPoseidonInfo(url) {
    try {
      console.log(`📄 Obteniendo info de PoseidonHD2: ${url}`);
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
        if (text.length > 100 && !text.includes('Ver')) {
          synopsis = text;
          return false;
        }
      });
      
      // Poster
      let poster = $('img').first().attr('src');
      if (poster && poster.startsWith('//')) poster = 'https:' + poster;
      
      // ==================== SERVIDORES ====================
      const downloadLinks = [];
      
      // Buscar enlaces con data-tr (contienen base64)
      $('[data-tr]').each((i, el) => {
        const dataTr = $(el).attr('data-tr');
        const serverName = $(el).find('span').first().text().trim();
        const quality = $(el).find('span').last().text().trim() || 'HD';
        
        if (dataTr && dataTr !== '#') {
          downloadLinks.push({
            server: serverName || `Servidor ${i+1}`,
            url: dataTr,
            type: 'iframe',
            quality: quality
          });
        }
      });
      
      // También buscar iframes directos
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
      
      console.log(`✅ PoseidonHD2: ${downloadLinks.length} servidores encontrados`);
      
      // Detectar tipo
      let type = 'movie';
      if (url.includes('/serie/')) type = 'serie';
      else if (url.includes('/episodio/')) type = 'episode';
      
      return {
        title: title,
        synopsis: synopsis.substring(0, 500) || 'Sinopsis no disponible',
        year: year,
        url: url,
        provider: 'poseidon',
        poster: poster,
        downloadLinks: downloadLinks,
        type: type
      };
    } catch (error) {
      console.error('Error en getPoseidonInfo:', error.message);
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
      
      const title = $('h1').first().text().trim() || 'Episodio';
      
      const downloadLinks = [];
      
      $('[data-tr]').each((i, el) => {
        const dataTr = $(el).attr('data-tr');
        const serverName = $(el).find('span').first().text().trim();
        
        if (dataTr && dataTr !== '#') {
          downloadLinks.push({
            server: serverName || `Servidor ${i+1}`,
            url: dataTr,
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