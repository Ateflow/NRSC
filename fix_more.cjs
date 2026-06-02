const fs = require('fs');
let phys = fs.readFileSync('src/utils/fusionPhysics.ts', 'utf8');
phys = phys.replace(/LEGO Technic/g, 'industrial');
phys = phys.replace(/Lego Studded/g, 'metallic');
phys = phys.replace(/Lego pin studs/g, 'rivets');
fs.writeFileSync('src/utils/fusionPhysics.ts', phys);

let types = fs.readFileSync('src/types.ts', 'utf8');
types = types.replace(/export interface LegoPart/g, 'export interface SystemComponent');
types = types.replace(/legoShape/g, 'componentShape');
fs.writeFileSync('src/types.ts', types);
