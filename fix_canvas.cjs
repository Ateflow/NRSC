const fs = require('fs');
let code = fs.readFileSync('src/components/SimulationCanvas.tsx', 'utf8');
code = code.replace(/legoAudio/g, 'reactorAudio');
// also change drawLegoBrick to drawComponent
code = code.replace(/drawLegoBrick/g, 'drawComponent');
// and replace some terms
code = code.replace(/Lego/g, 'System');
code = code.replace(/legoShape/g, 'componentShape');
code = code.replace(/lego/gi, 'system');
fs.writeFileSync('src/components/SimulationCanvas.tsx', code);
