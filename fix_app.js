const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/const INITIAL_LEGO_PARTS.*?\];/s, '');
fs.writeFileSync('src/App.tsx', code);
