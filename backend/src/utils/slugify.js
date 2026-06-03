function slugify(input) {
  if (!input || input.trim() === '') return '';
  
  const lowerInput = input.toLowerCase();
  
  // Casos especiales (como en tu código Kotlin)
  const specialCases = [
    { condition: lowerInput.includes('guardián') && (lowerInput.includes('refugio') || lowerInput.includes('protector')), result: 'shelter-el-protector' },
    { condition: lowerInput.includes('instinto implacable'), result: 'protector-vwSojy' },
    { condition: lowerInput.includes('protector'), result: 'protector-vwSojy' }
  ];
  
  for (const special of specialCases) {
    if (special.condition) {
      console.log(`🎯 Slug especial: "${input}" -> ${special.result}`);
      return special.result;
    }
  }
  
  // Normalizar (igual que tu función slugify de Kotlin)
  let s = input
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios, guiones
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Guiones múltiples a uno solo
    .replace(/^-|-$/g, ''); // Quitar guiones al inicio/final
  
  console.log(`🔠 Slugify: "${input}" -> "${s}"`);
  return s;
}

module.exports = { slugify };