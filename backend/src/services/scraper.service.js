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
  
  // ==================== CINECALIDAD ====================
  async searchCinecalidad(query) {
    const domains = [
      'https://www.cinecalidad.ec',
      'https://www.cinecalidad.rs',
      'https://cinecalidad.onl',
      'https://www.cinecalidad.am'
    ];
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const domain of domains) {
      try {
        const searchUrl = `${domain}/?s=${encodeURIComponent(query)}`;
        console.log(`🔍 Buscando en ${domain}`);
        const response = await axios.get(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 15000
        });
        const $ = cheerio.load(response.data);
        
        // Buscar en todos los tipos de contenido
        const selectors = [
          'a[href*="/ver-pelicula/"]',
          'a[href*="/pelicula/"]',
          'a[href*="/ver-serie/"]',
          'a[href*="/series/"]',
          'a[href*="/animes/"]'
        ];
        
        for (const selector of selectors) {
          $(selector).each((i, el) => {
            const url = $(el).attr('href');
            let title = $(el).find('h3, .title, .entry-title').text().trim();
            if (!title) title = $(el).text().trim();
            
            if (title && title.toLowerCase().includes(queryLower)) {
              let type = 'movie';
              if (url.includes('/series/')) type = 'serie';
              else if (url.includes('/animes/')) type = 'anime';
              
              results.push({
                id: null,
                title: title,
                url: url,
                thumbnail: $(el).find('img').attr('src'),
                provider: 'cinecalidad',
                type: type
              });
            }
          });
        }
        
        if (results.length > 0) break;
      } catch (error) {
        console.log(`Error en ${domain}:`, error.message);
      }
    }
    
    return results;
  }
  
  // ==================== BÚSQUEDA COMBINADA ====================
 async search(query) {
  console.log(`🔍 Buscando: "${query}"`);
  
  // PRIMERO: Buscar en Cinecalidad (los que tienen URL)
  const cinecalidadResults = await this.searchCinecalidad(query);
  
  // Si hay resultados de Cinecalidad, devolver SOLO esos
  if (cinecalidadResults.length > 0) {
    console.log(`✅ ${cinecalidadResults.length} resultados de Cinecalidad`);
    return cinecalidadResults;
  }
  
  // SOLO si no hay resultados de Cinecalidad, buscar en TMDB
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
    try {
      console.log(`📄 Obteniendo info de: ${url}`);
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      // Detectar tipo de contenido
      let type = 'movie';
      if (url.includes('/series/')) type = 'serie';
      else if (url.includes('/animes/')) type = 'anime';
      
      // Título
      const title = $('h1').first().text().trim() || 'Sin título';
      
      // Año
      let year = null;
      $('.year, .date').each((i, el) => {
        const text = $(el).text();
        const match = text.match(/\b(19|20)\d{2}\b/);
        if (match) year = match[0];
      });
      
      // Sinopsis
      let synopsis = '';
      $('td p, .description, .sinopsis').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 100) {
          synopsis = text;
          return false;
        }
      });
      
      // Poster
      let poster = $('img[data-src*="tmdb"]').attr('data-src') || $('img[src*="tmdb"]').attr('src') || null;
      
      // Buscar en TMDB para mejorar información
      let tmdbData = null;
      try {
        const searchType = (type === 'serie') ? 'tv' : 'movie';
        const tmdbResponse = await axios.get(`${TMDB_BASE}/search/${searchType}`, {
          params: { api_key: TMDB_API_KEY, query: title, year: year, language: 'es' }
        });
        if (tmdbResponse.data.results && tmdbResponse.data.results.length > 0) {
          tmdbData = tmdbResponse.data.results[0];
          poster = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : poster;
          synopsis = tmdbData.overview || synopsis;
          year = tmdbData.release_date ? tmdbData.release_date.split('-')[0] : (tmdbData.first_air_date ? tmdbData.first_air_date.split('-')[0] : year);
        }
      } catch (err) { console.log('TMDB no disponible'); }
      
      // ==================== SERVIDORES ====================
      const downloadLinks = [];
      
      $('#playeroptionsul .dooplay_player_option').each((i, el) => {
        const dataOption = $(el).attr('data-option');
        const serverName = $(el).text().trim().replace(/Recomendado$/, '').trim();
        if (dataOption && dataOption !== '#') {
          const match = dataOption.match(/zopass=([^&]+)/);
          if (match && match[1]) {
            try {
              const decodedUrl = Buffer.from(match[1], 'base64').toString('utf-8');
              downloadLinks.push({ server: serverName || `Servidor ${i+1}`, url: decodedUrl, type: 'iframe' });
            } catch(e) {
              downloadLinks.push({ server: serverName || `Servidor ${i+1}`, url: dataOption, type: 'iframe' });
            }
          } else {
            downloadLinks.push({ server: serverName || `Servidor ${i+1}`, url: dataOption, type: 'iframe' });
          }
        }
      });
      
      $('#sbss a').each((i, el) => {
        const href = $(el).attr('href');
        const serverName = $(el).find('li').text().trim() || 'Descarga';
        if (href && href !== '#') {
          downloadLinks.push({ server: serverName, url: href, type: 'download' });
        }
      });
      
      // ==================== EPISODIOS (para series/animes) ====================
      let episodes = [];
      
      if (type === 'serie' || type === 'anime') {
        // Buscar temporadas y episodios
        $('.se-c, .season-tab, .temporada').each((i, el) => {
          const seasonNum = $(el).find('.se-q, .season-number').text().trim().match(/\d+/);
          const episodeList = [];
          
          $(el).find('.episodiotitle a, .episode-item, .episodio a').each((j, ep) => {
            const epUrl = $(ep).attr('href');
            const epNum = $(ep).find('.num, .episode-number').text().trim() || (j + 1).toString();
            const epTitle = $(ep).find('.title').text().trim() || `Episodio ${epNum}`;
            
            if (epUrl && epUrl !== '#') {
              episodeList.push({
                number: epNum,
                title: epTitle,
                url: epUrl.startsWith('http') ? epUrl : `https://cinecalidad.onl${epUrl}`
              });
            }
          });
          
          if (episodeList.length > 0) {
            episodes.push({
              season: seasonNum ? parseInt(seasonNum[0]) : 1,
              episodes: episodeList
            });
          }
        });
        
        // Si no encontró temporadas, buscar episodios sueltos
        if (episodes.length === 0) {
          $('.episodios a, .episode-item').each((i, el) => {
            const epUrl = $(el).attr('href');
            const epNum = (i + 1).toString();
            const epTitle = $(el).text().trim() || `Episodio ${epNum}`;
            
            if (epUrl && epUrl !== '#') {
              episodes.push({
                number: epNum,
                title: epTitle,
                url: epUrl.startsWith('http') ? epUrl : `https://cinecalidad.onl${epUrl}`
              });
            }
          });
        }
      }
      
      console.log(`✅ ${downloadLinks.length} servidores, ${episodes.length} episodios`);
      
      return {
        title: title,
        synopsis: synopsis.substring(0, 500) || 'Sinopsis no disponible',
        year: year,
        url: url,
        provider: 'cinecalidad',
        type: type,
        poster: poster,
        voteAverage: tmdbData?.vote_average,
        downloadLinks: downloadLinks,
        episodes: episodes
      };
    } catch (error) {
      console.error('Error en getInfo:', error.message);
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
    
    $('#playeroptionsul .dooplay_player_option').each((i, el) => {
      const dataOption = $(el).attr('data-option');
      const serverName = $(el).text().trim().replace(/Recomendado$/, '').trim();
      if (dataOption && dataOption !== '#') {
        const match = dataOption.match(/zopass=([^&]+)/);
        if (match && match[1]) {
          try {
            const decodedUrl = Buffer.from(match[1], 'base64').toString('utf-8');
            downloadLinks.push({ server: serverName, url: decodedUrl, type: 'iframe' });
          } catch(e) {
            downloadLinks.push({ server: serverName, url: dataOption, type: 'iframe' });
          }
        } else {
          downloadLinks.push({ server: serverName, url: dataOption, type: 'iframe' });
        }
      }
    });
    
    return {
      title: title,
      downloadLinks: downloadLinks
    };
  } catch (error) {
    console.error('Error en getEpisodeInfo:', error.message);
    return null;
  }
}
}

module.exports = new ScraperService();