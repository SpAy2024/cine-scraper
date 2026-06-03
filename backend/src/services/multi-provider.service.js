const axios = require('axios');
const cheerio = require('cheerio');
const { slugify } = require('../utils/slugify');
const { extraerServidoresEmbed69 } = require('../utils/embed69-resolver');

const SERVERS_ALLOWED = ['streamwish', 'filelions', 'vidhide', 'filemoon', 'voe', 'goodstream', 'hlswish'];

class MultiProviderService {
  
  async buscarServidoresPorTitulo(title, titleEnglish = '') {
    let allServers = [];
    
    const candidateUrls = [
      'https://pelisplushd.bz/pelicula/',
      'https://www.pelisplushd.la/pelicula/',
      'https://www.cinecalidad.rs/pelicula/',
      'https://www.cinecalidad.ec/ver-pelicula/'
    ];
    
    for (const baseUrl of candidateUrls) {
      try {
        const slug = await this.obtenerSlugCompleto(title) || slugify(title);
        if (!slug) continue;
        
        const fullUrl = baseUrl + slug;
        console.log(`🌍 Probando URL: ${fullUrl}`);
        
        const response = await axios.get(fullUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 15000
        });
        const $ = cheerio.load(response.data);
        
        // Estilo viejo: li.playurl (como en tu código Kotlin)
        for (const el of $('li.playurl').toArray()) {
          const dataUrl = $(el).attr('data-url')?.trim();
          const serverName = $(el).find('a').text().trim() || 'Servidor';
          const dataName = $(el).attr('data-name') || 'Latino';
          
          if (dataUrl) {
            if (serverName.toLowerCase() === 'embed69') {
              const internalServers = await extraerServidoresEmbed69(dataUrl);
              allServers.push(...internalServers.filter(s => SERVERS_ALLOWED.includes(s.server.toLowerCase())));
            } else if (SERVERS_ALLOWED.includes(serverName.toLowerCase())) {
              allServers.push({
                server: serverName,
                url: dataUrl,
                audio: dataName || 'Latino',
                quality: 'HD'
              });
            }
          }
        }
        
        // Estilo nuevo: ul.TbVideoNv (como en tu código Kotlin)
        for (const tab of $('ul.TbVideoNv li').toArray()) {
          const serverName = $(tab).find('a').text().trim();
          const dataId = $(tab).attr('data-id');
          let url = $('#video-content iframe').attr('src') || '';
          
          if (!url) {
            const scripts = $('script').map((i, s) => $(s).html()).get().join('\n');
            const regex = new RegExp(`video\\[${dataId}\\]\\s*=\\s*['"]([^'"]+)['"]`);
            const match = scripts.match(regex);
            if (match) url = match[1];
          }
          
          if (url) {
            if (serverName.toLowerCase() === 'embed69') {
              const internalServers = await extraerServidoresEmbed69(url);
              allServers.push(...internalServers.filter(s => SERVERS_ALLOWED.includes(s.server.toLowerCase())));
            } else if (SERVERS_ALLOWED.includes(serverName.toLowerCase())) {
              allServers.push({
                server: serverName,
                url: url,
                audio: 'Latino',
                quality: 'HD'
              });
            }
          }
        }
        
        if (allServers.length > 0) return allServers;
        
      } catch (error) {
        console.log(`Error en ${baseUrl}:`, error.message);
      }
    }
    
    // Fallback a CineCalidad (como en tu código Kotlin)
    if (allServers.length === 0) {
      allServers = await this.buscarServidoresCineCalidad(title);
    }
    
    // Fallback a título en inglés (como en tu código Kotlin)
    if (allServers.length === 0 && titleEnglish && titleEnglish !== title) {
      console.log(`🌎 Intentando con título en inglés: "${titleEnglish}"`);
      return await this.buscarServidoresPorTitulo(titleEnglish);
    }
    
    return allServers;
  }
  
  async obtenerSlugCompleto(title) {
    try {
      const searchUrl = `https://pelisplushd.bz/buscar?q=${encodeURIComponent(title)}`;
      const response = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const $ = cheerio.load(response.data);
      
      const enlace = $('a[href^="/pelicula/"]').first().attr('href');
      if (enlace) {
        const slugCompleto = enlace.replace('/pelicula/', '');
        console.log(`🔗 Slug completo detectado: ${slugCompleto}`);
        return slugCompleto;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  
  async buscarServidoresCineCalidad(title) {
    const servers = [];
    const slug = slugify(title);
    const url = `https://www.cinecalidad.ec/ver-pelicula/${slug}`;
    
    try {
      console.log(`🎬 Buscando en CineCalidad: ${url}`);
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      $('#playeroptionsul .dooplay_player_option').each((i, el) => {
        const dataOption = $(el).attr('data-option');
        const serverName = $(el).text().trim().replace(/Recomendado$/, '').trim();
        if (dataOption && dataOption !== '#') {
          const match = dataOption.match(/zopass=([^&]+)/);
          if (match && match[1]) {
            const decodedUrl = Buffer.from(match[1], 'base64').toString('utf-8');
            servers.push({ server: serverName, url: decodedUrl, type: 'iframe', quality: 'HD' });
          }
        }
      });
    } catch (error) {
      console.log('Error en CineCalidad:', error.message);
    }
    
    return servers;
  }
}

module.exports = new MultiProviderService();