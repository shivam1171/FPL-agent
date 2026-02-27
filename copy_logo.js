const fs = require('fs');
const src = 'C:/Users/shiva.000/.gemini/antigravity/brain/7bd653bc-8206-490b-8473-823c2df0f228/epl_logo_clean_1772154214824.png';
const dst = 'D:/FPL Agent/frontend/public/pl-logo-white.png';
try {
  fs.copyFileSync(src, dst);
  console.log('SUCCESS: File copied');
} catch(e) {
  console.error('ERROR:', e.message);
}
