/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SimulationState, Particle } from '../types';

export interface FusionTelemetry {
  density: number;          // 10^19 m^-3
  temperature: number;      // Million Kelvin (MK)
  confinementTime: number;  // seconds (tau_E)
  qFactor: number;          // Fusion energy gain Q
  powerMW: number;          // Fusion Power
  reactorStatus: SimulationState['reactorStatus'];
  dangerLevel: number;
  narration: string;
  narrType: SimulationState['activeNarrationType'];
}

/**
 * Calculates high-fidelity thermonuclear Tokamak magnetic fusion physics.
 * Models plasma confinement, fuel mixing, neutral beam injection auxiliary heating and thermal disruption limits.
 */
export function calculateFusionPhysics(
  currentState: SimulationState,
  delta: number,
  activeParticlesCount: number
): FusionTelemetry {
  const B = currentState.magneticField * 10; // Toroidal Field mapped from 0-10 Tesla to 0-100%
  const P_aux = currentState.auxiliaryHeating; // Auxiliary Heating 0 - 120 MW
  const fuelRatio = currentState.tritiumInjection; // 0 - 100% Tritium, optimum is 50/50 D-T

  // 1. Confinement Time tau_E (seconds)
  // Scaling with toroidal magnet current and auxiliary power saturation
  const confinementTime = 0.15 + (B / 100) * 1.65 * (1.0 / (1.0 + P_aux * 0.005));

  // 2. Fuel Mix Efficiency: maximum at 50% Tritium / 50% Deuterium mix
  const mixEfficiency = Math.max(0.01, 1.0 - Math.abs(fuelRatio - 50) / 50);

  // 3. Plasma Density n (10^19 m^-3)
  // Density increases with gas injection but is constrained (Greenwald limit) by magnetic confinement field
  const greenwaldLimit = (B / 100) * 8.5;
  const rawDensity = (fuelRatio / 50) * 4.5 * (B / 100 + 0.15);
  const density = Math.max(0.1, Math.min(greenwaldLimit, rawDensity));

  // 4. Plasma Temperature T (Million Kelvin, MK)
  // Heating increases with auxiliary source MW + self-heating feedback from burning alpha particles of fusion reactions
  let selfHeating = 0;
  
  // Calculate raw fusion power for self-heating feedback loop
  // The D-T reaction rate peak is modeled around 130 MK
  const optimalTemp_MK = 130;
  const tempScalar = Math.max(0, 1.0 - Math.pow((currentState.plasmaTemperature - optimalTemp_MK) / 95, 2));
  const tempFissionFeedback = Math.pow(density, 2) * tempScalar * mixEfficiency * 3.8;
  const rawPower = Math.min(1000, tempFissionFeedback);
  selfHeating = Math.min(300, rawPower * 0.35); // 35% of energy carried by alphas is deposited back as plasma self-heating!

  let targetT = 1.0; // background core cold temperature
  if (B >= 42) {
    // Plasma is successfully confined! Auxiliary heat + self heat drives core to millions of kelvin
    targetT = 1.0 + (P_aux + selfHeating) * 1.55 * (0.35 + 0.65 * (B / 100));
  } else {
    // Low magnetic field -> Confinement collapse! Immediate plasma thermal quench to background level
    targetT = 1.5 + (Math.random() * 2);
  }

  // Smooth temperature convergence over time
  let temperature = currentState.plasmaTemperature + (targetT - currentState.plasmaTemperature) * 0.085;
  if (currentState.scramActive) {
    temperature = Math.max(0.1, currentState.plasmaTemperature - delta * 120);
  }

  // 5. Accurate Fusion Power MW
  const hotMultiplier = Math.max(0, 1.0 - Math.pow((temperature - optimalTemp_MK) / 95, 2));
  const fusionPower = Math.max(0, Math.pow(density, 2) * hotMultiplier * mixEfficiency * 9.5);
  const powerOutput = temperature > 35 ? Math.min(1000, fusionPower) : 0;

  // 6. Fusion Gain Factor Q
  let qFactor = 0;
  if (powerOutput > 0) {
    qFactor = powerOutput / Math.max(1.0, P_aux);
  }

  // 7. Core Wall Meltdown Danger Level (%)
  // Plasma disruption happens if there is too much density or field drops too low. Heat escapes and heats reactor limit wall.
  let dangerLevel = 0;
  let isDisrupting = B < 42 && P_aux > 10;
  if (isDisrupting) {
    dangerLevel = Math.min(100, (P_aux * 0.6) + (currentState.plasmaTemperature * 0.35));
  } else if (temperature > 140) {
    dangerLevel = Math.min(100, (temperature - 140) * 0.9 + (B > 95 ? 12 : 0));
  }

  // 8. Custom State Machine mapping and realistic scientific narrator logs
  let status: SimulationState['reactorStatus'] = 'STABLE_PLASMA';
  let narration = currentState.activeNarration;
  let narrType = currentState.activeNarrationType;

  if (currentState.scramActive) {
    status = 'SCRAMMED';
    narration = "QUENCH TRIGGERED. Magnetic coils reversed. Thermonuclear plasma safely collapsed to vacuum state.";
    narrType = 'info';
  } else if (B < 42) {
    status = 'DISRUPTION_MELT';
    narration = "CRITICAL: Magnetic field insufficient for confinement. Plasma striking first wall! Disruption and thermal damage imminent.";
    narrType = 'warning';
  } else if (temperature > 120 && qFactor > 5.0) {
    status = 'STABLE_PLASMA';
    narration = "IGNITION ACHIEVED. Thermonuclear burning plasma stabilized. Q-ratio exceeding break-even. Net positive energy production.";
    narrType = 'epic';
  } else if (temperature > 85 && qFactor > 1.0) {
    status = 'OPTIMAL';
    narration = "Nominal equilibrium sustained. Q > 1.0, generating net thermal output. Confinement scaling matches prediction.";
    narrType = 'success';
  } else {
    status = 'STARTING';
    narration = "Deuterium-Tritium injected. Applying Aux Neutral Beams (NBI) and RF heating to reach threshold ignition temperature.";
    narrType = 'info';
  }

  return {
    density: parseFloat(density.toFixed(2)),
    temperature: Math.round(temperature),
    confinementTime: parseFloat(confinementTime.toFixed(2)),
    qFactor: parseFloat(qFactor.toFixed(2)),
    powerMW: Math.round(powerOutput),
    reactorStatus: status,
    dangerLevel: Math.round(dangerLevel),
    narration,
    narrType
  };
}

/**
 * Draws a premium, high-fidelity industrial nuclear Tokamak fusion reactor cross-section.
 * Inspired by JT-60SA and ITER with magnetic field lines and a swirling pink torus plasma ring.
 */
export function drawTokamak(
  ctx: CanvasRenderingContext2D,
  dimensions: { width: number; height: number },
  currentState: SimulationState,
  sX: number,
  sY: number,
  hoverCoord: { x: number; y: number } | null
) {
  const cx = 35 * sX; // Torus center X coord
  const cy = 52 * sY; // Torus center Y coord
  const rX = 18 * sX; // Toroidal radius X
  const rY = 24 * sY; // Toroidal radius Y

  // Draw deep space futuristic grid background represent magnet control room
  ctx.fillStyle = '#04060a';
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);

  // Drawing sci-fi star field background inside tokamak cavity
  ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, rY * 1.5, 0, Math.PI * 2);
  ctx.fill();

  const isQuenched = currentState.reactorStatus === 'SCRAMMED' || currentState.plasmaTemperature < 10;

  // 1. Swirling Tokamak Thermonuclear Plasma (Glorious Neon Toroidal Slice)
  if (!isQuenched) {
    const isDisrupted = currentState.reactorStatus === 'DISRUPTION_MELT';
    const tempIntensity = Math.min(1.0, currentState.plasmaTemperature / 150);
    const plasmaRadiusX = rX * (0.85 + Math.sin(performance.now() / 150) * 0.03);
    const plasmaRadiusY = rY * (0.85 + Math.cos(performance.now() / 150) * 0.03);

    ctx.save();
    // Glowing backlight of the plasma pool
    const blobGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, rY * 1.4);
    if (isDisrupted) {
      blobGrad.addColorStop(0, 'rgba(239, 68, 68, 0.65)'); // bright red disruption
      blobGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.25)');
      blobGrad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      blobGrad.addColorStop(0, `rgba(236, 72, 153, ${0.5 * tempIntensity})`); // deep pink
      blobGrad.addColorStop(0.4, `rgba(168, 85, 247, ${0.35 * tempIntensity})`); // violet
      blobGrad.addColorStop(0.8, `rgba(34, 211, 238, ${0.1 * tempIntensity})`); // cyan cherenkov edges
      blobGrad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = blobGrad;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Render the toroidal core loops represent magnetic confinement boundaries
    ctx.lineWidth = 14;
    ctx.strokeStyle = isDisrupted ? 'rgba(220, 38, 38, 0.15)' : 'rgba(236, 72, 153, 0.12)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, plasmaRadiusX, plasmaRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Hot swirling fluid plasma string (Pink, violet overlay filaments)
    ctx.lineWidth = 4 + tempIntensity * 5;
    ctx.strokeStyle = isDisrupted ? '#ef4444' : '#ec4899';
    ctx.shadowBlur = 15;
    ctx.shadowColor = isDisrupted ? '#f87171' : '#f472b6';
    ctx.beginPath();
    ctx.ellipse(cx, cy, plasmaRadiusX, plasmaRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Animated rotating magnetic flux curves (ribbons wrapping around torus)
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    const ribbonsCount = 12;
    const timeShift = performance.now() / 400;
    
    for (let i = 0; i < ribbonsCount; i++) {
        const angle = (Math.PI * 2 / ribbonsCount) * i + timeShift;
        const rx = cx + Math.cos(angle) * plasmaRadiusX;
        const ry = cy + Math.sin(angle) * plasmaRadiusY;
        
        ctx.beginPath();
        // Inner swirl spiral
        ctx.arc(rx, ry, 12 + tempIntensity * 8, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#e879f9'; // Cyan vs Rose flux lines
        ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Central Solenoid Column - metallic core beam (JT-60SA style magnetic spine)
  const solenoidX = cx;
  const solenoidY = 16 * sY;
  const solenoidW = 7 * sX;
  const solenoidH = 70 * sY;

  // Central Solenoid stack shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(solenoidX - solenoidW/2 + 5, solenoidY + 5, solenoidW, solenoidH);

  // Central Solenoid metal base (slate gray)
  ctx.fillStyle = '#334155';
  ctx.fillRect(solenoidX - solenoidW/2, solenoidY, solenoidW, solenoidH);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(solenoidX - solenoidW/2, solenoidY, solenoidW, solenoidH);

  // Coils winding bands (representing copper spools wrapped around the solenoid block)
  ctx.fillStyle = '#b45309'; // deep copper amber
  const coilBands = 8;
  for (let i = 0; i < coilBands; i++) {
    const cyy = solenoidY + (solenoidH / coilBands) * (i + 0.15);
    const cbh = (solenoidH / coilBands) * 0.4;
    ctx.fillRect(solenoidX - solenoidW/2 - 2, cyy, solenoidW + 4, cbh);
    // Draw copper stud pins
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(solenoidX - 3, cyy + cbh / 2 - 2, 6, 4);
    ctx.fillStyle = '#b45309';
  }

  // Solenoid center glow when magnetic field is strong
  if (currentState.magneticField > 0) {
    const magIntensity = currentState.magneticField / 10;
    const solGrad = ctx.createLinearGradient(solenoidX - 4, solenoidY, solenoidX + 4, solenoidY);
    solGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
    solGrad.addColorStop(0.5, `rgba(34, 211, 238, ${0.85 * magIntensity})`);
    solGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = solGrad;
    ctx.fillRect(solenoidX - 4, solenoidY, 8, solenoidH);
  }

  // Label Central Solenoid
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CS SOLENOID', solenoidX, solenoidY + solenoidH - 5);


  // 3. Toroidal Coils (D-shape silver Magnet frames enclosing the chamber)
  // Drawn at multiple horizontal intervals radiating out from central axis
  ctx.save();
  ctx.strokeStyle = '#475569'; // steel color
  ctx.lineWidth = 8;
  ctx.shadowBlur = 4;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';

  const drawMagneticCoilFrame = (fx: number, fy: number, rw: number, rh: number) => {
    ctx.beginPath();
    ctx.ellipse(fx, fy, rw, rh, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Draw mechanical rivets along the D-frames
    ctx.fillStyle = '#334155';
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const sx = fx + Math.cos(angle) * rw;
      const sy = fy + Math.sin(angle) * rh;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Draw 2 massive structural magnetic D-coils on both sides of solenoid
  drawMagneticCoilFrame(cx - 10 * sX, cy, 11 * sX, 26 * sY);
  drawMagneticCoilFrame(cx + 10 * sX, cy, 11 * sX, 26 * sY);
  ctx.restore();


  // 4. Lithium Blanket outer cooling wall (red/grey segments at edge boundaries of chamber)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, rY * 1.32, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, rY * 1.32, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // 5. Draw Auxiliary Beams (Neutral NBI conduits launching in from top left)
  const beamX = cx - 22 * sX;
  const beamY = cy - 20 * sY;
  ctx.fillStyle = 'rgba(11, 12, 16, 0.9)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.fillRect(beamX - 10, beamY - 4, 25, 8);
  ctx.strokeRect(beamX - 10, beamY - 4, 25, 8);
  
  ctx.fillStyle = '#ff7878';
  ctx.font = 'bold 6.5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NBI HEAT', beamX + 2, beamY + 2);

  if (currentState.auxiliaryHeating > 10 && !isQuenched) {
    // Inject energetic orange lightning lasers into core
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(beamX + 15, beamY);
    ctx.lineTo(cx - 8 * sX, cy - 8 * sY);
    ctx.stroke();

    // Laser sparkling sparks inside plasma core
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 8 * sX - 3, cy - 8 * sY - 3, 6, 6);
  }


  // 6. Interactive Radar Hover / target reticle inside Tokamak
  if (hoverCoord) {
    const hx = hoverCoord.x;
    const hy = hoverCoord.y;

    // Is mouse hovering in plasma core?
    const dx = hx - 35;
    const dy = hy - 52;
    const distance = Math.sqrt(dx * dx + (dy * dy) / 1.5);
    const inPlasma = distance < 25;

    ctx.save();
    ctx.translate(hx * sX, hy * sY);
    ctx.rotate((performance.now() / 250) % (Math.PI * 2));
    ctx.strokeStyle = inPlasma ? '#f472b6' : '#22d3ee';
    ctx.lineWidth = 1.6;
    
    // Draw sci fi crosshair ring over Tokamak grid
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-18, 0); ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0); ctx.lineTo(18, 0);
    ctx.moveTo(0, -18); ctx.lineTo(0, -8);
    ctx.moveTo(0, 8); ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.restore();
  }
}
