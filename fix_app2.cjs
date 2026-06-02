const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace color schemes
code = code.replace(/selection:bg-amber-500/g, 'selection:bg-blue-500');
code = code.replace(/bg-gradient-to-r from-\[#ffdfa9\] via-\[#f7c271\] to-\[#e69f37\]/g, 'bg-gradient-to-r from-slate-200 via-blue-100 to-slate-300');
code = code.replace(/text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-blue-100 to-slate-300/g, 'text-gray-100'); // Actually just make it clean white
code = code.replace(/bg-amber-500\/20/g, 'bg-blue-500/20');
code = code.replace(/text-amber-300/g, 'text-blue-300');
code = code.replace(/border-amber-500\/30/g, 'border-blue-500/30');
code = code.replace(/text-\[#cfa45d\]/g, 'text-blue-400');
code = code.replace(/border-\[#cfa45d\]/g, 'border-blue-900/50');
code = code.replace(/bg-gradient-to-r from-amber-500 to-yellow-500/g, 'bg-gradient-to-r from-blue-600 to-cyan-600');
code = code.replace(/border-yellow-300\/40/g, 'border-cyan-400/40');
code = code.replace(/text-amber-500/g, 'text-blue-400');
code = code.replace(/bg-amber-500\/5/g, 'bg-blue-500/5');

// Update text
code = code.replace(/OVERSEER SCADA/g, 'TELEMETRY SCADA');
code = code.replace(/Advanced Fission Core/g, 'Nuclear Reactor Simulation Core');
code = code.replace(/Science Manual/g, 'System Documentation');
code = code.replace(/Technic Nuclear energy simulation/g, 'Advanced Nuclear Energy Simulation');

fs.writeFileSync('src/App.tsx', code);
