const fs = require('fs');
const path = require('path');

const map = {
  "AlimentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n": "Alimentación",
  "InspecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n": "Inspección",
  "UbicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n": "Ubicación",
  "ubicaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n": "ubicación",
  "estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n": "están",
  "DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a": "Día",
  "CategorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a": "Categoría",
  "ManutenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n": "Manutención",
  "AÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“ADIR": "AÑADIR",
  "AverÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a": "Avería",
  "DÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½?A": "DÍA",
  "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬": "€",
  "ÃƒÆ’Ã‚Â¢Ã¢â€šÂ¬Ãƒâ€šÃ‚Â¢": "•",
  "ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦": "✅",
  "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¾": "💾",
  "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¢": "🌐",
  "Ã¢Å“â€¦": "✅",
  "Ã°Å¸â€™Â¾": "💾",
  "Ã°Å¸â€ºÂ¡": "🛡️",
  "TÃƒâ€°CNICO": "TÉCNICO",
  "NÃ‚Âº": "Nº",
  "TÃƒÂ©cnico": "Técnico",
  "InstalaciÃƒÂ³n": "Instalación",
  "UBICACIÃƒâ€œN": "UBICACIÓN",
  "DescripciÃƒÂ³n": "Descripción",
  "ValidaciÃƒÂ³n": "Validación",
  "vÃ¡lido": "válido",
  "MÃƒÂ¡s": "Más",
  "AÃƒÂ±adir": "Añadir",
  "diseÃƒÂ±o": "diseño",
  "Ãƒâ€°": "É",
  "ÃƒÂ©": "é",
  "ÃƒÂ³": "ó",
  "ÃƒÂ¡": "á",
  "ÃƒÂ­": "í",
  "ÃƒÂº": "ú",
  "ÃƒÂ±": "ñ",
  "Ãƒâ€œ": "Ó",
  "Ã‚Âº": "º",
  "Ã‚Âª": "ª",
  "Ã‚Â¡": "¡",
  "Ã‚Â¿": "¿",
  "Ãƒâ€˜": "Ñ",
  "Ã¢â‚¬â€œ": "–",
  "Ã¢â‚¬â€ ": "—",
  "Ã¢â‚¬Å“": "“",
  "Ã¢â‚¬Â ": "”",
  "Ã¢â‚¬Ëœ": "‘",
  "Ã¢â‚¬â„¢": "’",
  "vÃ¡lido": "válido",
  "Ã¡": "á",
  "Ã©": "é",
  "Ã­": "í",
  "Ã³": "ó",
  "Ãº": "ú",
  "Ã±": "ñ",
  "Ã\u00A1": "á",
  "Ã\u00A9": "é",
  "Ã\u00AD": "í",
  "Ã\u00B3": "ó",
  "Ã\u00BA": "ú",
  "Ã\u00B1": "ñ"
};

const filesToFix = [
  'src/app/inspection/components/RegistroGastoForm.tsx',
  'src/app/inspection/components/forms/InformeTrabajoForm.tsx',
  'src/app/inspection/components/forms/InformeTecnicoForm.tsx',
  'src/app/inspection/components/forms/InformeSimplificadoForm.tsx',
  'src/app/inspection/components/forms/InformeRevisionForm.tsx',
  'src/app/inspection/components/forms/HojaTrabajoForm.tsx',
  'src/app/inspection/components/forms/RevisionBasicaForm.tsx',
  'src/app/auth/inspection/page.tsx',
  'src/app/inspection/page.tsx'
];

const keys = Object.keys(map).sort((a, b) => b.length - a.length);

console.log('Starting replacements...');

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;
    
    for (const key of keys) {
      if (content.includes(key)) {
        content = content.split(key).join(map[key]);
      }
    }
    
    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Fixed formatting in ${filePath}`);
    } else {
      console.log(`No changes needed in ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
