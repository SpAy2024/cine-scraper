// services/scraper.service.js (versión mejorada)
const multiProvider = require('./multi-provider.service');

class ScraperService {
  
  async search(query) {
    // Búsqueda normal...
  }
  
  async getInfo(url) {
    // Si es una URL de Cinecalidad, usar el método existente
    if (url.includes('cinecalidad')) {
      return await this.getCinecalidadInfo(url);
    }
    
    // Si es de otra fuente, usar el multi-proveedor
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
  
  extractTitleFromUrl(url) {
    // Extraer título de la URL
    const match = url.match(/\/(?:pelicula|ver-pelicula)\/([^\/]+)/);
    if (match) {
      return match[1].replace(/-/g, ' ');
    }
    return '';
  }
}