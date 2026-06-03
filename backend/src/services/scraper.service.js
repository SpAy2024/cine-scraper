const axios = require('axios');
const cheerio = require('cheerio');

class ScraperService {
  
  async search(query) {
    const domains = [
      'https://www.cinecalidad.am',
      'https://www.cinecalidad.ec',
      'https://www.cinecalidad.rs',
      'https://cinecalidad.onl'
    ];
    
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
        
        $('a[href*="/ver-pelicula/"], a[href*="/pelicula/"]').each((i, el) => {
          const url = $(el).attr('href');
          let title = $(el).find('h3, .title').text().trim();
          if (!title) title = $(el).text().trim();
          
          // Buscar coincidencia exacta
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
        
        if (results.length > 0) {
          console.log(`✅ Encontrados ${results.length} resultados en ${domain}`);
          break;
        }
      } catch (error) {
        console.log(`Error en ${domain}:`, error.message);
      }
    }
    
    return results;
  }
  
  async getInfo(url) {
    try {
      console.log(`📄 Obteniendo info de: ${url}`);
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      const title = $('h1').first().text().trim() || 'Sin título';
      console.log(`📌 Título: ${title}`);
      
      const downloadLinks = [];
      
      // Servidores online
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
      
      // Descargas
      $('#sbss a').each((i, el) => {
        const href = $(el).attr('href');
        const serverName = $(el).find('li').text().trim() || 'Descarga';
        if (href && href !== '#') {
          downloadLinks.push({ server: serverName, url: href, type: 'download' });
        }
      });
      
      console.log(`✅ ${downloadLinks.length} servidores encontrados`);
      
      return {
        title: title,
        synopsis: 'Sinopsis no disponible',
        url: url,
        provider: 'cinecalidad',
        downloadLinks: downloadLinks
      };
    } catch (error) {
      console.error('Error en getInfo:', error.message);
      return null;
    }
  }
}

module.exports = new ScraperService();