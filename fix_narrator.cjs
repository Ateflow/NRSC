const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/import SimulationNarrator from '\.\/components\/SimulationNarrator';/g, "import TelemetryConsole from './components/TelemetryConsole';");
appCode = appCode.replace(/<SimulationNarrator state=\{simState\} \/>/g, "<TelemetryConsole state={simState} />");
fs.writeFileSync('src/App.tsx', appCode);

// Also let's clean up SimulationControls.tsx (replace amber/cfa45d with blue/slate themes)
let controlsCode = fs.readFileSync('src/components/SimulationControls.tsx', 'utf8');
controlsCode = controlsCode.replace(/amber-500/g, 'blue-500');
controlsCode = controlsCode.replace(/\[#cfa45d\]/g, 'cyan-500');
controlsCode = controlsCode.replace(/amber-400/g, 'blue-400');
controlsCode = controlsCode.replace(/yellow-600/g, 'slate-600');
controlsCode = controlsCode.replace(/amber-300/g, 'blue-300');
controlsCode = controlsCode.replace(/yellow-500/g, 'cyan-500');
controlsCode = controlsCode.replace(/amber-950/g, 'blue-950');
controlsCode = controlsCode.replace(/amber-100/g, 'blue-100');
controlsCode = controlsCode.replace(/pink-500/g, 'indigo-500');
controlsCode = controlsCode.replace(/#121319/g, '#0f172a'); // slate-900
fs.writeFileSync('src/components/SimulationControls.tsx', controlsCode);
