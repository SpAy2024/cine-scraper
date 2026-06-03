const BaseProvider = require('./BaseProvider');

class PelisPlusProvider extends BaseProvider {
  constructor() {
    super('pelisplus', 'https://pelisplus21.com', '/pelicula/');
    
    this.domains = [
      'https://pelisplus21.com',
      'https://www.pelisplus21.com'
    ];
  }

  async search(query, year = null) {
    const searchUrl = `${this.baseURL}/?s=${encodeURIComponent(query)}`;
    console.log(`🔍 Buscando en ${this.name}: ${searchUrl}`);
    
    const $ = await this.fetchHTML(searchUrl);
    if (!$) return [];

    const movies = [];
    const queryLower = query.toLowerCase();
    
    $('a[href*="/pelicula/"]').each((i, el) => {
      let url = $(el).attr('href');
      if (url && url.includes('/pelicula/')) {
        let title = $(el).find('h3, .title, .entry-title').text().trim();
        if (!title) title = $(el).text().trim();
        
        let itemYear = null;
        const yearMatch = title.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) itemYear = yearMatch[0];
        
        if (title.toLowerCase().includes(queryLower)) {
          const fullUrl = url.startsWith('http') ? url : this.baseURL + url;
          
          movies.push({
            id: this.extractId(url),
            title: title,
            year: itemYear,
            url: fullUrl,
            thumbnail: $(el).find('img').attr('src') || null,
            provider: this.name,
            type: 'movie'
          });
        }
      }
    });
    
    console.log(`✅ ${this.name}: ${movies.length} resultados`);
    return movies;
  }

  async getInfo(url) {
    console.log(`📄 ${this.name}.getInfo(): ${url}`);
    const $ = await this.fetchHTML(url);
    if (!$) return null;
    
    // Título
    const title = $('h1').first().text().trim() || 'Sin título';
    
    // Año
    let year = null;
    $('.year, .date, .extra span').each((i, el) => {
      const text = $(el).text();
      const match = text.match(/\b(19|20)\d{2}\b/);
      if (match) year = match[0];
    });
    
    // Sinopsis
    let synopsis = '';
    $('.wp-content p, .description, .sinopsis, meta[name="description"]').each((i, el) => {
      if (el.name === 'meta') {
        const content = $(el).attr('content');
        if (content && content.length > 100) synopsis = content;
      } else {
        const text = $(el).text().trim();
        if (text.length > 100 && !synopsis) synopsis = text;
      }
    });
    
    // Poster
    let poster = $('.poster img, .sheader .poster img, meta[property="og:image"]').attr('src') || null;
    
    // ==================== SERVIDORES ====================
    const downloadLinks = [];
    
    // Buscar opciones de player (dooplay_player_option)
    $('.dooplay_player_option').each((i, el) => {
      const dataPost = $(el).attr('data-post');
      const dataNume = $(el).attr('data-nume');
      const dataType = $(el).attr('data-type');
      const serverName = $(el).find('.title').text().trim() || $(el).find('.server').text().trim();
      
      if (dataPost && dataNume && dataType === 'movie') {
        // URL del endpoint AJAX de DooPlay
        const ajaxUrl = `https://pelisplus21.com/wp-admin/admin-ajax.php?action=dooplay_player&post=${dataPost}&nume=${dataNume}&type=${dataType}`;
        downloadLinks.push({
          server: serverName || `Servidor ${i+1}`,
          url: ajaxUrl,
          type: 'ajax',
          quality: 'VER ONLINE',
          isAjax: true,
          postId: dataPost,
          nume: dataNume
        });
      }
    });
    
    // Buscar iframes directos
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('http') && !src.includes('youtube')) {
        downloadLinks.push({
          server: `Reproductor ${i+1}`,
          url: src,
          type: 'iframe',
          quality: 'VER ONLINE'
        });
      }
    });
    
    // Enlaces de descarga
    $('.links_table a, .download-links a').each((i, el) => {
      const href = $(el).attr('href');
      const serverName = $(el).text().trim() || 'Descarga';
      if (href && href !== '#') {
        downloadLinks.push({
          server: serverName,
          url: href,
          type: 'download',
          quality: $(el).closest('tr').find('.quality').text().trim() || 'HD'
        });
      }
    });
    
    console.log(`✅ ${this.name}: ${downloadLinks.length} enlaces encontrados`);
    
    return {
      title: title,
      synopsis: synopsis.substring(0, 500) || 'Sinopsis no disponible',
      year: year,
      url: url,
      provider: this.name,
      poster: poster,
      downloadLinks: downloadLinks
    };
  }
}

module.exports = PelisPlusProvider;