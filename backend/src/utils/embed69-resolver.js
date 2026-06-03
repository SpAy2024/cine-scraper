// utils/embed69-resolver.js
const axios = require('axios');

function decodeJwt(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length >= 2) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
      const json = JSON.parse(payload);
      return json.link || json.url || json.src || json.video || null;
    }
    return null;
  } catch (error) {
    console.error('Error decodificando JWT:', error.message);
    return null;
  }
}

async function extraerServidoresEmbed69(embedUrl) {
  const servers = [];
  
  try {
    console.log(`🔓 Extrayendo servidores de Embed69: ${embedUrl}`);
    const response = await axios.get(embedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000
    });
    
    const html = response.data;
    
    // Buscar dataLink = [...]
    const regex = /dataLink\s*=\s*(\[.*?\]);/s;
    const match = html.match(regex);
    
    if (match) {
      const dataLink = JSON.parse(match[1]);
      
      for (const fileObj of dataLink) {
        const embeds = fileObj.sortedEmbeds || [];
        for (const embed of embeds) {
          const serverName = embed.servername;
          const encryptedLink = embed.link;
          const realUrl = decodeJwt(encryptedLink) || encryptedLink;
          
          servers.push({
            server: serverName,
            url: realUrl,
            type: 'iframe',
            quality: 'HD'
          });
        }
      }
    }
    
    console.log(`✅ Embed69: ${servers.length} servidores encontrados`);
  } catch (error) {
    console.error('Error en extraerServidoresEmbed69:', error.message);
  }
  
  return servers;
}

module.exports = { extraerServidoresEmbed69, decodeJwt };