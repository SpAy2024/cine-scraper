// utils/slugify.js
function slugify(input) {
  if (!input || input.trim() === '') return '';
  
  const lowerInput = input.toLowerCase();
  
  // Casos especiales
  const specialCases = {
    'guardián refugio': 'shelter-el-protector',
    'guardián protector': 'shelter-el-protector',
    'instinto implacable': 'protector-vwSojy',
    'protector': 'protector-vwSojy'
  };
  
  for (const [key, value] of Object.entries(specialCases)) {
    if (lowerInput.includes(key)) {
      console.log(`🎯 Slug especial: "${key}" -> ${value}`);
      return value;
    }
  }
  
  // Normalizar
  let s = input
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // solo letras, números, espacios, guiones
    .replace(/\s+/g, '-') // espacios a guiones
    .replace(/-+/g, '-') // guiones múltiples a uno solo
    .replace(/^-|-$/g, ''); // quitar guiones al inicio/final
  
  console.log(`🔠 Slugify: "${input}" -> "${s}"`);
  return s;
}

module.exports = { slugify };