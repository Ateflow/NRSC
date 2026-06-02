const fs = require('fs');

let canvasCode = fs.readFileSync('src/components/SimulationCanvas.tsx', 'utf8');

// Colors
canvasCode = canvasCode.replace(/'#7c3aed'/g, "'#334155'");
canvasCode = canvasCode.replace(/'#5b21b6'/g, "'#1e293b'");
canvasCode = canvasCode.replace(/'#a78bfa'/g, "'#94a3b8'");
canvasCode = canvasCode.replace(/'#eab308'/g, "'#475569'");
canvasCode = canvasCode.replace(/'#ca8a04'/g, "'#334155'");
canvasCode = canvasCode.replace(/'#facc15'/g, "'#64748b'");
canvasCode = canvasCode.replace(/'#0284c7'/g, "'#0f172a'");
canvasCode = canvasCode.replace(/'#0369a1'/g, "'#020617'");
canvasCode = canvasCode.replace(/'#0d9488'/g, "'#1e293b'");
canvasCode = canvasCode.replace(/'#0f766e'/g, "'#0f172a'");

// Replace the jagged action star outline with a clean data ring
canvasCode = canvasCode.replace(/\/\/ Puss in boots jagged action star outline[\s\S]*?ctx\.fill\(\);/m, `// Clean data ring
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();`);

// Remove bold/comic fonts
canvasCode = canvasCode.replace(/ctx\.font = '900 \${11 \+ \(\(1 - f\.life\) \* 8\)}px sans-serif';/g, "ctx.font = 'bold 10px monospace';");
canvasCode = canvasCode.replace(/ctx\.font = 'bold 8px monospace';/g, "ctx.font = '500 9px monospace';");
canvasCode = canvasCode.replace(/ctx\.fillStyle = '#000000';/g, "ctx.fillStyle = '#ffffff';");

// Tweak some pop-up texts
canvasCode = canvasCode.replace(/'FISSION!'/g, "'NEUTRON EVENT'");
canvasCode = canvasCode.replace(/'TURBINE BOOST!'/g, "'ROTATION OVERRIDE'");
canvasCode = canvasCode.replace(/'PUMP PRIMED!'/g, "'FLOW OVERRIDE'");
canvasCode = canvasCode.replace(/'DYNAMO SURGE!'/g, "'EXCITER CALIBRATED'");

fs.writeFileSync('src/components/SimulationCanvas.tsx', canvasCode);
