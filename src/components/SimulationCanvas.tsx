/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { SimulationState, Particle, ReactMode } from '../types';
import { reactorAudio } from './AudioEngine';
import { calculateFusionPhysics, drawTokamak } from '../utils/fusionPhysics';

interface SimulationCanvasProps {
  simState: SimulationState;
  onUpdateState: (params: Partial<SimulationState>) => void;
}

export default function SimulationCanvas({
  simState,
  onUpdateState,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [fissionAnims, setFissionAnims] = useState<{ x: number; y: number; life: number; id: string }[]>([]);

  // Keep references to access the latest state in requestAnimationFrame loop
  const stateRef = useRef(simState);
  useEffect(() => {
    stateRef.current = simState;
    // Keep alarm sync with audio engine
    reactorAudio.setAlarmActive(simState.reactorStatus === 'OVERHEATING' || simState.meltdownDanger > 70);
  }, [simState]);

  // Touch/Mouse click detector elements
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const clickQueueRef = useRef<{ x: number; y: number }[]>([]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    hoverRef.current = { x, y };
  };

  const handleMouseLeave = () => {
    hoverRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    clickQueueRef.current.push({ x, y });
  };

  // Handle ResizeObserver for responsive canvas bounding boxes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Maintain a neat 16:10 aspect ratio or safe minimum heights
        const targetWidth = Math.max(width, 500);
        const targetHeight = Math.max((targetWidth * 9) / 16, 380);
        setDimensions({ width: targetWidth, height: targetHeight });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Main high-fidelity physics animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let gearRotation = 0;
    const fissionAnimations: { x: number; y: number; text: string; life: number; color: string }[] = [];
    let animationFrameId: number;
    let lastTime = performance.now();
    let screenShakeAmplitude = 0;

    // Real Nuclear Chemical state parameters
    let localXenonLevel = 32.5; 
    let localKEffective = 1.0;

    // Fixed locations for our stylized physical modular reactor components inside canvas
    // These coordinates are normalized (0 to 100) and scaled in render
    const segments = {
      core: { x: 25, y: 55, w: 20, h: 32 },
      steamCoreBWR: { x: 25, y: 35, w: 20, h: 20 },
      boilerPWR: { x: 55, y: 40, w: 16, h: 32 },
      turbine: { x: 56, y: 15, w: 14, h: 18 },
      generator: { x: 76, y: 15, w: 12, h: 18 },
      condenser: { x: 55, y: 80, w: 16, h: 14 },
      coolingTower: { x: 82, y: 55, w: 15, h: 36 },
      controlAssembly: { x: 25, y: 24, w: 20, h: 6 },
    };

    // Uranium Core Fuel Rod cells (individual System studs containing Uranium pellets)
    const fuelPellets = [
      { x: 28, y: 62, active: true, fissionCooldown: 0 },
      { x: 32, y: 62, active: true, fissionCooldown: 0 },
      { x: 35, y: 62, active: true, fissionCooldown: 0 },
      { x: 38, y: 62, active: true, fissionCooldown: 0 },
      { x: 42, y: 62, active: true, fissionCooldown: 0 },
      { x: 28, y: 72, active: true, fissionCooldown: 0 },
      { x: 32, y: 72, active: true, fissionCooldown: 0 },
      { x: 35, y: 72, active: true, fissionCooldown: 0 },
      { x: 38, y: 72, active: true, fissionCooldown: 0 },
      { x: 42, y: 72, active: true, fissionCooldown: 0 },
      { x: 28, y: 82, active: true, fissionCooldown: 0 },
      { x: 32, y: 82, active: true, fissionCooldown: 0 },
      { x: 35, y: 82, active: true, fissionCooldown: 0 },
      { x: 38, y: 82, active: true, fissionCooldown: 0 },
      { x: 42, y: 82, active: true, fissionCooldown: 0 },
    ];

    // Seed initial neutrons
    for (let i = 0; i < 8; i++) {
      particles.push({
        id: `neutron-${Math.random()}`,
        x: 23 + Math.random() * 24,
        y: 53 + Math.random() * 34,
        vx: (Math.random() - 0.5) * 4.5,
        vy: (Math.random() - 0.5) * 4.5,
        type: 'neutron',
        life: 1,
        size: 3.5,
        color: '#22d3ee', // teal Cherenkov light
      });
    }

    const runLoop = (timeNow: number) => {
      const delta = (timeNow - lastTime) / 1000;
      lastTime = timeNow;

      const currentState = stateRef.current;

      // Drain manual mouse clicking trigger queues first
      const isFusion = currentState.reactorType === 'FUSION';
      while (clickQueueRef.current.length > 0) {
        const click = clickQueueRef.current.shift();
        if (click) {
          const cx = click.x;
          const cy = click.y;

          if (isFusion) {
            // Processing clicking inside circular Tokamak vacuum chamber centered at x:35, y:52
            const dx = cx - 35;
            const dy = cy - 52;
            const dist = Math.sqrt(dx * dx + (dy * dy) / 1.5);
            
            if (dist < 26) {
              // Pulse compression and Auxiliary wave injection surge!
              onUpdateState({
                auxiliaryHeating: Math.min(120, currentState.auxiliaryHeating + 10),
                magneticField: Math.min(100, currentState.magneticField + 4)
              });
              
              fissionAnimations.push({
                x: cx,
                y: cy,
                text: 'AUX HEATING SURGE',
                life: 1.0,
                color: '#ec4899',
              });

              // Add sparkling high energy fusion particles
              for (let i = 0; i < 12; i++) {
                particles.push({
                  id: `manual-fusion-${Math.random()}`,
                  x: cx,
                  y: cy,
                  vx: (Math.random() - 0.5) * 11,
                  vy: (Math.random() - 0.5) * 11,
                  type: 'power_spark',
                  life: 0.9,
                  size: 2.5,
                  color: '#e879f9',
                });
              }

              if (currentState.soundEnabled) {
                reactorAudio.playSnap();
              }
            } else {
              // Click outside: Magnet coil resonance
              fissionAnimations.push({
                x: cx,
                y: cy,
                text: 'COIL OSCILLATION',
                life: 0.8,
                color: '#60a5fa',
              });
              
              if (currentState.soundEnabled) {
                reactorAudio.playClick();
              }
            }
          } else {
            // Perform Fission component coordinate checks (0 to 100 grid space)
            const inCore = cx >= segments.core.x && cx <= (segments.core.x + segments.core.w) &&
                           cy >= segments.core.y && cy <= (segments.core.y + segments.core.h);
            
            const inTurbine = cx >= segments.turbine.x && cx <= (segments.turbine.x + segments.turbine.w) &&
                              cy >= segments.turbine.y && cy <= (segments.turbine.y + segments.turbine.h);

            const inCondenser = cx >= segments.condenser.x && cx <= (segments.condenser.x + segments.condenser.w) &&
                                cy >= segments.condenser.y && cy <= (segments.condenser.y + segments.condenser.h);

            const inGenerator = cx >= segments.generator.x && cx <= (segments.generator.x + segments.generator.w) &&
                                cy >= segments.generator.y && cy <= (segments.generator.y + segments.generator.h);

            if (inCore) {
              // Trigger 6 fast energetic yellow/orange neutrons at selected study coordinates
              for (let i = 0; i < 6; i++) {
                particles.push({
                  id: `manual-neutron-${Math.random()}`,
                  x: cx + (Math.random() - 0.5) * 3,
                  y: cy + (Math.random() - 0.5) * 3,
                  vx: (Math.random() - 0.5) * 11,
                  vy: (Math.random() - 0.5) * 11,
                  type: 'neutron',
                  life: 1,
                  size: 4.2,
                  color: '#22d3ee', // bright cyan cherenkov light
                });
              }
              fissionAnimations.push({
                x: cx,
                y: cy,
                text: 'NEUTRON INJECTION',
                life: 1.0,
                color: '#22d3ee',
              });
              screenShakeAmplitude = Math.max(screenShakeAmplitude, 10);
              if (currentState.soundEnabled) {
                reactorAudio.playSnap();
              }
            } else if (inTurbine) {
              // Spin turbine cog boost
              onUpdateState({
                turbineRPM: Math.min(3600, currentState.turbineRPM + 600)
              });
              fissionAnimations.push({
                x: cx,
                y: cy,
                text: 'ROTATION OVERRIDE',
                life: 1.0,
                color: '#c084fc',
              });
              for (let i = 0; i < 8; i++) {
                particles.push({
                  id: `manual-spark-${Math.random()}`,
                  x: cx,
                  y: cy,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  type: 'power_spark',
                  life: 0.8,
                  size: 2,
                  color: '#475569',
                });
              }
              if (currentState.soundEnabled) {
                reactorAudio.playClick();
              }
            } else if (inCondenser) {
              // Prime coolant impeller pump speed
              onUpdateState({
                pumpSpeed: Math.min(100, currentState.pumpSpeed + 15)
              });
              fissionAnimations.push({
                x: cx,
                y: cy,
                text: 'FLOW OVERRIDE',
                life: 1.0,
                color: '#38bdf8',
              });
              if (currentState.soundEnabled) {
                reactorAudio.playSnap();
              }
            } else if (inGenerator) {
              // Dynamo electric shock
              onUpdateState({
                totalElectricityProduced: currentState.totalElectricityProduced + 320 // manual kinetic dynamos turn
              });
              fissionAnimations.push({
                x: cx,
                y: cy,
                text: 'EXCITER CALIBRATED',
                life: 1.0,
                color: '#fbbf24',
              });
              for (let i = 0; i < 15; i++) {
                particles.push({
                  id: `manual-spark-${Math.random()}`,
                  x: cx,
                  y: cy,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  type: 'power_spark',
                  life: 0.9,
                  size: 2.2,
                  color: '#fbbf24',
                });
              }
              if (currentState.soundEnabled) {
                reactorAudio.playClick();
              }
            }
          }
        }
      }

      // Ensure Audio frequency and ticking matches dynamic rates
      if (currentState.soundEnabled) {
        reactorAudio.updateCoreHum(currentState.fissionRate, currentState.temperature);
        reactorAudio.updateGearSounds(currentState.turbineRPM);
      }

      // Physics State Calculations
      const rodsInPercent = currentState.controlRodPosition; // 0 to 100
      let activeNeutronCount = particles.filter(p => p.type === 'neutron').length;

      // Keep reaction tick alive representing natural radiation or heater core
      if (activeNeutronCount < 3 && !currentState.scramActive && currentState.reactorStatus !== 'OFF') {
        particles.push({
          id: `neutron-gen-${Math.random()}`,
          x: 23 + Math.random() * 24,
          y: 60 + Math.random() * 15,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          type: 'neutron',
          life: 1,
          size: 4,
          color: '#38bdf8',
        });
      }

      // Dynamic Xenon poisoning reactor modeling over time (Xe-135 built up from fission)
      const isFissionActiveNow = activeNeutronCount > 0;
      if (isFissionActiveNow) {
        localXenonLevel += (activeNeutronCount / 10) * 0.35 * delta;
      } else {
        localXenonLevel -= 0.65 * delta;
      }
      localXenonLevel = Math.max(0, Math.min(100, localXenonLevel));

      // Calculate dynamic k-effective Reactivity scalar
      localKEffective = (1.45 - (rodsInPercent / 100) * 0.95) - (localXenonLevel / 100) * 0.22;
      localKEffective += (Math.random() - 0.5) * 0.009; // thermal fluctuation noise jitter
      localKEffective = Math.max(0.01, Math.min(2.0, localKEffective));

      // SCRAM active heavily speeds up control rods drop and drops fission rate
      let coreAbsorptionRate = rodsInPercent / 100;

      // Particle update step
      particles = particles.map(p => {
        // Move particles
        p.x += p.vx * 60 * delta;
        p.y += p.vy * 60 * delta;

        if (p.type === 'neutron') {
          // Keep inside core boundary box
          const b = segments.core;
          const leftBound = b.x;
          const rightBound = b.x + b.w;
          const topBound = b.y;
          const bottomBound = b.y + b.h;

          // Boundary bouncing
          if (p.x < leftBound) { p.x = leftBound; p.vx *= -1; }
          if (p.x > rightBound) { p.x = rightBound; p.vx *= -1; }
          if (p.y < topBound) { p.y = topBound; p.vy *= -1; }
          if (p.y > bottomBound) { p.y = bottomBound; p.vy *= -1; }

          // SCRAM or control rod absorption check: Top zone absorption
          // Control rods are inserted from the top. So higher Y coordinate = deeper penetration
          const rodYLimit = b.y + (b.h * (rodsInPercent / 100));
          if (p.y < rodYLimit && Math.random() < 0.65) {
            // Neutron is absorbed by the boron control rods!
            p.life = 0; // kill
          }

          // Xenon-135 isotope neutron absorption check (sponge)
          if (p.life > 0 && Math.random() < (localXenonLevel / 100) * 0.16) {
            p.life = 0; // absorbed chemically by xenon pit poisoning
            // emit quiet blue sparkle puff
            particles.push({
              id: `xenon-abs-${Math.random()}`,
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 1.5,
              vy: (Math.random() - 0.5) * 1.5,
              type: 'explosion_spark',
              life: 0.5,
              size: 2,
              color: '#3b82f6',
            });
          }

          // Fuel pellet collision and splitting (The Core Fusion!)
          fuelPellets.forEach(pellet => {
            if (pellet.fissionCooldown <= 0) {
              const dx = p.x - pellet.x;
              const dy = p.y - pellet.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance < 2.5) {
                // SPLIT ACTION!
                pellet.fissionCooldown = 15; // frames
                p.life = 0; // consumed

                // Calculate heat impact and shake
                screenShakeAmplitude = Math.max(screenShakeAmplitude, 6);

                // Add text comic explosion
                fissionAnimations.push({
                  x: pellet.x,
                  y: pellet.y,
                  text: 'NEUTRON EVENT',
                  life: 1.0,
                  color: '#ef4444',
                });

                // Spawn 2 or 3 brand new high-speed neutrons
                const newNeutronsCount = Math.random() > 0.45 ? 3 : 2;
                for (let k = 0; k < newNeutronsCount; k++) {
                  particles.push({
                    id: `neutron-spawn-${Math.random()}`,
                    x: pellet.x + (Math.random() - 0.5) * 2,
                    y: pellet.y + (Math.random() - 0.5) * 2,
                    vx: (Math.random() - 0.5) * 8, // fast neutrons
                    vy: (Math.random() - 0.5) * 8,
                    type: 'neutron',
                    life: 1,
                    size: 4,
                    color: '#64748b', // yellow energetic neutrons
                  });
                }

                // Add sparkling orange energy dust
                for (let e = 0; e < 4; e++) {
                  particles.push({
                    id: `sparkle-${Math.random()}`,
                    x: pellet.x,
                    y: pellet.y,
                    vx: (Math.random() - 0.5) * 3,
                    vy: (Math.random() - 0.5) * 3,
                    type: 'explosion_spark',
                    life: 1,
                    size: 2,
                    color: '#f97316',
                  });
                }
              }
            }
          });
        }

        // Decay life or handle screen exit
        if (p.type === 'explosion_spark' || p.type === 'steam') {
          p.life -= delta * 1.5;
        }

        return p;
      }).filter(p => p.life > 0);

      // Decrement fuel pellet cooldowns
      fuelPellets.forEach(p => {
        if (p.fissionCooldown > 0) p.fissionCooldown -= 1;
      });

      // Update screen shake
      if (screenShakeAmplitude > 0) {
        screenShakeAmplitude -= delta * 12;
        if (screenShakeAmplitude < 0) screenShakeAmplitude = 0;
      }

      // Update screen shake
      if (screenShakeAmplitude > 0) {
        screenShakeAmplitude -= delta * 12;
        if (screenShakeAmplitude < 0) screenShakeAmplitude = 0;
      }

      if (isFusion) {
        // Run Fusion Thermodynamic & Confinement calculations
        const telemetry = calculateFusionPhysics(currentState, delta, particles.length);
        
        // Spin the steam generator turbine from the harvested thermonuclear plasma heat core
        // Fusion heat captured inside lithium coolant wall generator (plasma temp > 30MK generates steam!)
        const heatTransferFraction = telemetry.temperature > 30 ? (telemetry.temperature - 30) * 1.6 : 0;
        const targetSteamRate = Math.min(100, heatTransferFraction * 0.45);
        const targetRPM = (targetSteamRate * 36) * (currentState.pumpSpeed / 100);
        const newRPM = currentState.turbineRPM + (targetRPM - currentState.turbineRPM) * 0.07;
        const calculatedElectricity = (newRPM / 3600) * 1000 * (telemetry.qFactor > 1 ? 1.25 : 0.8);
        const newEfficiency = newRPM > 10 ? Math.min(99, 45 + (currentState.pumpSpeed * 0.5)) : 0;
        const incrementalProduced = (calculatedElectricity / 3600) * delta * 1000;
        const totalPowerAccumulated = currentState.totalElectricityProduced + incrementalProduced;

        // Custom Sound frequency modulation for the high frequency Tokamak buzzing magnets
        if (currentState.soundEnabled) {
          reactorAudio.updateCoreHum(50 + Math.round(telemetry.density * 22), telemetry.temperature * 1.5);
          reactorAudio.updateGearSounds(newRPM);
        }

        if (Math.random() < 0.15) {
          onUpdateState({
            temperature: Math.round(telemetry.temperature),
            plasmaTemperature: Math.round(telemetry.temperature),
            plasmaDensity: parseFloat(telemetry.density.toFixed(2)),
            confinementTime: parseFloat(telemetry.confinementTime.toFixed(2)),
            fusionGain: parseFloat(telemetry.qFactor.toFixed(2)),
            
            pressure: Math.max(1, Math.round(telemetry.density * 1.8)),
            steamGeneration: Math.round(targetSteamRate),
            turbineRPM: Math.round(newRPM),
            powerOutput: Math.round(calculatedElectricity),
            efficiency: Math.round(newEfficiency),
            meltdownDanger: Math.round(telemetry.dangerLevel),
            totalElectricityProduced: totalPowerAccumulated,
            reactorStatus: telemetry.reactorStatus,
            fissionRate: Math.round(telemetry.density * 16), // mapped to show visual rate indicator
            activeNarration: telemetry.narration,
            activeNarrationType: telemetry.narrType,
          });
        }

        // Add spectacular high speed pink, green, and gold micro-particles spiraling around the tokamak core
        if (telemetry.temperature > 15 && Math.random() < 0.72) {
          const torusAngle = Math.random() * Math.PI * 2;
          const px = 35 + Math.cos(torusAngle) * 12 * (0.8 + Math.random() * 0.4);
          const py = 52 + Math.sin(torusAngle) * 18 * (0.8 + Math.random() * 0.4);
          
          particles.push({
            id: `plasma-part-${Math.random()}`,
            x: px,
            y: py,
            vx: -Math.sin(torusAngle) * 4 + (Math.random() - 0.5) * 1.5,
            vy: Math.cos(torusAngle) * 4 + (Math.random() - 0.5) * 1.5,
            type: Math.random() > 0.5 ? 'explosion_spark' : 'neutron',
            life: 0.85,
            size: 1.8 + Math.random() * 2,
            color: Math.random() > 0.6 ? '#38bdf8' : Math.random() > 0.3 ? '#ec4899' : '#e879f9', // Cyan/Rose/Purple plasma
          });

          // Shoot alpha particles & high speed fast neutrons if fusion is producing lots of power
          if (telemetry.powerMW > 100 && Math.random() < 0.35) {
            particles.push({
              id: `alpha-${Math.random()}`,
              x: px,
              y: py,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              type: 'power_spark',
              life: 1.0,
              size: 2.8,
              color: '#64748b', // alpha particle
            });
          }
        }

        // Steam plume from the cooling tower when operational
        if (newRPM > 180 && Math.random() < 0.25) {
          particles.push({
            id: `f-tow-steam-${Math.random()}`,
            x: segments.coolingTower.x + 8,
            y: segments.coolingTower.y,
            vx: 0.6 + (Math.random() - 0.5) * 1.2,
            vy: -2.3 - Math.random() * 1.8,
            type: 'steam',
            life: 1.0,
            size: 5 + Math.random() * 8,
            color: 'rgba(255, 255, 255, 0.32)',
          });
        }

        // Cog sparklers
        if (newRPM > 900 && Math.random() < 0.32) {
          particles.push({
            id: `f-spark-${Math.random()}`,
            x: segments.generator.x + 6,
            y: segments.generator.y + 8,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            type: 'power_spark',
            life: 0.8,
            size: 1.8,
            color: '#fbbf24',
          });
        }

        gearRotation += (newRPM * delta * 0.08);

      } else {
        // Run classic Fission physics logic update
        let baseHeatRate = activeNeutronCount * 2.5;
        let coolingFactor = (currentState.pumpSpeed / 100) * 1.8;

        let targetTemp = 20 + (baseHeatRate - coolingFactor) * 15;
        if (targetTemp < 20) targetTemp = 20;
        if (currentState.reactorStatus === 'OFF') targetTemp = 20;

        let newTemperature = currentState.temperature + (targetTemp - currentState.temperature) * 0.08;

        if (currentState.scramActive) {
          newTemperature = Math.max(20, currentState.temperature - delta * 85);
        }

        let targetPressure = 1 + (newTemperature * 0.14);
        if (currentState.coolantType === 'PWR') {
          targetPressure *= 1.45;
        }
        let newPressure = currentState.pressure + (targetPressure - currentState.pressure) * 0.05;

        let hasBoilingWater = newTemperature > 100;
        let steamSpeed = hasBoilingWater ? (newTemperature - 100) * 0.3 : 0;
        steamSpeed = Math.min(steamSpeed, 100);

        let targetRPM = (steamSpeed * 32) * (currentState.pumpSpeed / 100);
        targetRPM = Math.min(targetRPM, 3600);
        let newRPM = currentState.turbineRPM + (targetRPM - currentState.turbineRPM) * 0.06;

        let calculatedElectricity = (newRPM / 3600) * 1000;
        let newEfficiency = newRPM > 10 ? Math.min(98, 40 + (currentState.pumpSpeed * 0.5)) : 0;

        let dangerLevel = 0;
        if (newTemperature > 800) {
          dangerLevel = Math.min(100, ((newTemperature - 800) / 4) + (newPressure > 140 ? 15 : 0));
        }

        let incrementalProduced = (calculatedElectricity / 3600) * delta * 1000;
        let totalPowerAccumulated = currentState.totalElectricityProduced + incrementalProduced;

        // Ensure Audio frequency and ticking matches dynamic rates
        if (currentState.soundEnabled) {
          reactorAudio.updateCoreHum(activeNeutronCount * 12, newTemperature);
          reactorAudio.updateGearSounds(newRPM);
        }

        if (Math.random() < 0.15) {
          let newStatus: SimulationState['reactorStatus'] = 'OFF';
          if (dangerLevel > 70) newStatus = 'MELTDOWN';
          else if (newTemperature > 650) newStatus = 'OVERHEATING';
          else if (currentState.scramActive) newStatus = 'SCRAMMED';
          else if (newRPM > 1500) newStatus = 'OPTIMAL';
          else if (newRPM > 50) newStatus = 'STARTING';

          let narrative = currentState.activeNarration;
          let narrType = currentState.activeNarrationType;

          if (newStatus === 'MELTDOWN') {
            narrative = "SYSTEM ALERT: Core parameters exceed structural limits! Imminent thermal failure detected! SCRAM REQUIRED!";
            narrType = 'error';
          } else if (newStatus === 'OVERHEATING') {
            narrative = "WARNING: Thermal deviation detected. Core temperature exceeding safety margins. Insert control rods to absorb neutrons.";
            narrType = 'warning';
          } else if (newStatus === 'SCRAMMED') {
            narrative = "SCRAM SUCCESSFUL. Control rods fully inserted. Neutron flux halted. Standby for thermal cooldown.";
            narrType = 'info';
          } else if (newStatus === 'OPTIMAL') {
            narrative = "Steady state achieved. Primary coolant loop stable. Turbine maintaining optimal RPM for power generation.";
            narrType = 'success';
          } else if (newStatus === 'STARTING') {
            narrative = "Ignition achieved. Core reactivity rising. Establishing primary thermal gradient.";
            narrType = 'info';
          }

          onUpdateState({
            temperature: Math.round(newTemperature),
            pressure: Math.round(newPressure),
            steamGeneration: Math.round(steamSpeed),
            turbineRPM: Math.round(newRPM),
            powerOutput: Math.round(calculatedElectricity),
            efficiency: Math.round(newEfficiency),
            meltdownDanger: Math.round(dangerLevel),
            totalElectricityProduced: totalPowerAccumulated,
            reactorStatus: newStatus,
            fissionRate: Math.round(activeNeutronCount * 12),
            activeNarration: narrative,
            activeNarrationType: narrType,
          });
        }

        if (steamSpeed > 5 && Math.random() < (steamSpeed / 100)) {
          const xOffset = currentState.coolantType === 'BWR' ? segments.core.x + 8 : segments.boilerPWR.x + 8;
          const yOffset = currentState.coolantType === 'BWR' ? segments.core.y + 4 : segments.boilerPWR.y + 2;
          
          particles.push({
            id: `steam-${Math.random()}`,
            x: xOffset + (Math.random() - 0.5) * 6,
            y: yOffset,
            vx: (currentState.coolantType === 'BWR' ? 3.5 : 2),
            vy: -3.5 - Math.random() * 2,
            type: 'steam',
            life: 1.0,
            size: 4 + Math.random() * 5,
            color: 'rgba(255, 255, 255, 0.45)',
          });
        }

        if (newRPM > 200 && Math.random() < 0.3) {
          particles.push({
            id: `tow-steam-${Math.random()}`,
            x: segments.coolingTower.x + 8,
            y: segments.coolingTower.y,
            vx: 0.8 + (Math.random() - 0.5) * 1.5,
            vy: -2.5 - Math.random() * 2,
            type: 'steam',
            life: 1.0,
            size: 6 + Math.random() * 10,
            color: 'rgba(255, 255, 255, 0.35)',
          });
        }

        if (newRPM > 1000 && Math.random() < 0.4) {
          particles.push({
            id: `spark-${Math.random()}`,
            x: segments.generator.x + 6,
            y: segments.generator.y + 8,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            type: 'power_spark',
            life: 1,
            size: 2,
            color: '#64748b',
          });
        }

        gearRotation += (newRPM * delta * 0.08);
      }

      // Render Stage
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.save();

      // Apply screen shake (vibrancy for fission)
      if (screenShakeAmplitude > 0) {
        const dx = (Math.random() - 0.5) * screenShakeAmplitude;
        const dy = (Math.random() - 0.5) * screenShakeAmplitude;
        ctx.translate(dx, dy);
      }

      // Canvas Scaling Factors
      const sX = dimensions.width / 100;
      const sY = dimensions.height / 100;

      // Custom helper to draw gorgeous glossy System bricks on 2D space
      const drawComponent = (x: number, y: number, w: number, h: number, color1: string, color2: string, label: string) => {
        const rx = x * sX;
        const ry = y * sY;
        const rw = w * sX;
        const rh = h * sY;

        // Shadow depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(rx + 4, ry + 4, rw, rh);

        // Brick body
        const grad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(rx, ry, rw, rh);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry, rw, rh);

        // Top cap / Highlight border
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(rx + 2, ry + 2, rw - 4, 3);

        // Draw studs on the top
        const studsCount = Math.floor(w / 3.5);
        ctx.fillStyle = color1;
        for (let i = 0; i < studsCount; i++) {
          const sx = rx + (rw / studsCount) * (i + 0.5) - 5;
          const sy = ry - 5;
          ctx.fillRect(sx, sy, 10, 6);
          // Stud shadow
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(sx, sy + 4, 10, 2);
          ctx.fillStyle = color1;
        }

        // Clean label
        if (label) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '500 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, rx + rw / 2, ry + rh / 2 + 3);
        }
      };

      if (isFusion) {
        // Draw the amazing futuristic System Tokamak fusion chamber
        drawTokamak(ctx, dimensions, currentState, sX, sY, hoverRef.current);
      } else {
        // 1. Core Background & chernekov light
        ctx.fillStyle = '#0a0d16'; // deep carbon slate background
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);

        // Draw grid lines to feel like a system draft paper
        ctx.strokeStyle = 'rgba(207, 164, 93, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < dimensions.width; i += 30) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, dimensions.height);
          ctx.stroke();
        }
        for (let j = 0; j < dimensions.height; j += 30) {
          ctx.beginPath();
          ctx.moveTo(0, j);
          ctx.lineTo(dimensions.width, j);
          ctx.stroke();
        }

        // Core Nuclear Cherenkov Radiance (glowing cyan circle in core)
        if (activeNeutronCount > 0) {
          const radIntensity = Math.min(1.0, activeNeutronCount / 16);
          const centerCoreX = (segments.core.x + segments.core.w / 2) * sX;
          const centerCoreY = (segments.core.y + segments.core.h / 2) * sY;
          const radGrad = ctx.createRadialGradient(
            centerCoreX, centerCoreY, 5,
            centerCoreX, centerCoreY, (segments.core.w) * sX * 1.6
          );
          radGrad.addColorStop(0, `rgba(34, 211, 238, ${0.45 * radIntensity})`);
          radGrad.addColorStop(0.3, `rgba(14, 116, 144, ${0.2 * radIntensity})`);
          radGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = radGrad;
          ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        }

        // 2. Draw Reactor Coolant Loop / piping lines (System connectors)
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw primary coolant pipelines
        ctx.beginPath();
        // Pipe from bottom pump to Core bottom
        ctx.moveTo((segments.core.x + 8) * sX, (segments.condenser.y + 6) * sY);
        ctx.lineTo((segments.core.x + 8) * sX, (segments.core.y + segments.core.h) * sY);
        ctx.stroke();

        // Top pipe to Boiler or turbine
        ctx.beginPath();
        ctx.strokeStyle = currentState.temperature > 150 ? '#ef4444' : '#3b82f6'; // heating loop
        ctx.moveTo((segments.core.x + segments.core.w - 4) * sX, (segments.core.y + 4) * sY);
        if (currentState.coolantType === 'BWR') {
          // Direct to turbine
          ctx.lineTo((segments.core.x + segments.core.w - 4) * sX, (segments.turbine.y + 6) * sY);
          ctx.lineTo(segments.turbine.x * sX, (segments.turbine.y + 6) * sY);
        } else {
          // To heat exchanger
          ctx.lineTo((segments.boilerPWR.x + 4) * sX, (segments.core.y + 4) * sY);
          ctx.lineTo((segments.boilerPWR.x + 4) * sX, (segments.boilerPWR.y + 6) * sY);
        }
        ctx.stroke();

        // Draw system piping studs on pipelines
        ctx.fillStyle = '#64748b';
        for (let pLine = 0.2; pLine < 0.9; pLine += 0.25) {
          ctx.beginPath();
          ctx.arc((segments.core.x + segments.core.w - 4) * sX, ((segments.core.y + 4) + (segments.turbine.y - segments.core.y) * pLine) * sY, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Draw system bricks (Core block container, turbine housing, condenser, tower)
        // Draw the reactor containment vessel shroud (System brick container)
        drawComponent(segments.core.x, segments.core.y, segments.core.w, segments.core.h, '#475569', '#1e293b', '');
        
        // Secondary shell glass overlay inside core to inspect atoms
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(segments.core.x * sX, segments.core.y * sY, segments.core.w * sX, segments.core.h * sY);

        // Draw nuclear reactor core fuel pellets inside reactor vessel
        fuelPellets.forEach(pellet => {
          const px = pellet.x * sX;
          const py = pellet.y * sY;
          
          // Draw uranium structural stud
          ctx.fillStyle = '#dc2626'; // system red base
          ctx.beginPath();
          ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#991b1b';
          ctx.stroke();

          // If split cooldown is active, draw yellow fiery shell
          if (pellet.fissionCooldown > 0) {
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(px, py, 8.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Inner glossy glow
          ctx.fillStyle = '#fca5a5';
          ctx.beginPath();
          ctx.arc(px - 2, py - 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw the Control Rods sliding assembly
        // Boron absorption rods slide down vertically inside the fuel grids
        const rodsDepth = rodsInPercent / 100; // 0 to 1
        const rodGap = (segments.core.w - 5) / 4;
        
        // Control plate header beam (sliding System Technic beam)
        const rodHeaderY = (segments.core.y + (segments.core.h * 0.7 * rodsDepth)) - 10;
        drawComponent(segments.core.x + 1, rodHeaderY, segments.core.w - 2, 3, '#ea580c', '#c2410c', 'BORON ABSORBER BAR');

        // The actual cylindrical rod rods hanging down
        ctx.fillStyle = '#4b5563'; // metal grey
        for (let rIdx = 0; rIdx < 4; rIdx++) {
          const rodX = (segments.core.x + 3.2 + (rIdx * 4.5)) * sX;
          const rodTop = (rodHeaderY + 3) * sY;
          const rodBottom = (rodHeaderY + 3 + (segments.core.h * 0.65)) * sY;
          
          ctx.fillRect(rodX - 3, rodTop, 6, rodBottom - rodTop);
          // Add yellow mechanical indicator pins
          ctx.fillStyle = '#475569';
          ctx.fillRect(rodX - 2, rodTop, 4, 3);
          ctx.fillStyle = '#4b5563';
        }

        // Draw Heat Exchanger (Boiler) if PWR Mode is active
        if (currentState.coolantType === 'PWR') {
          drawComponent(segments.boilerPWR.x, segments.boilerPWR.y, segments.boilerPWR.w, segments.boilerPWR.h, '#0f172a', '#020617', 'STEAM BOILER');
          
          // Inside boiler coil (orange heat tube)
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo((segments.boilerPWR.x + 4) * sX, (segments.boilerPWR.y + 4) * sY);
          ctx.lineTo((segments.boilerPWR.x + 12) * sX, (segments.boilerPWR.y + 12) * sY);
          ctx.lineTo((segments.boilerPWR.x + 4) * sX, (segments.boilerPWR.y + 20) * sY);
          ctx.lineTo((segments.boilerPWR.x + 12) * sX, (segments.boilerPWR.y + 28) * sY);
          ctx.stroke();
        }
      }

      // 4. Turbine Housing & spinning mechanical spur gears!
      drawComponent(segments.turbine.x, segments.turbine.y, segments.turbine.w, segments.turbine.h, '#334155', '#1e293b', 'TURBINE');

      // Rotation drawing helper for dynamic mechanical system gearwheels
      const drawSystemGear = (gx: number, gy: number, radius: number, teeth: number, angle: number, color: string) => {
        const cx = gx * sX;
        const cy = gy * sY;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Core hub
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();

        // System Technic peg-cross center
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-3, -12, 6, 24);
        ctx.fillRect(-12, -3, 24, 6);

        // Draw individual spur gear teeth
        ctx.fillStyle = color;
        for (let i = 0; i < teeth; i++) {
          ctx.rotate((Math.PI * 2) / teeth);
          ctx.beginPath();
          ctx.moveTo(-5, -radius - 1);
          ctx.lineTo(-3, -radius - 8);
          ctx.lineTo(3, -radius - 8);
          ctx.lineTo(5, -radius - 1);
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.restore();
      };

      // Draw high-quality gear train linking steam turbine rotor to Technic dynamo generator!
      // Turbine Rotor gear (large purple 40-tooth gear)
      const turbineGearAngle = gearRotation;
      drawSystemGear(segments.turbine.x + 7, segments.turbine.y + 8, 22, 16, turbineGearAngle, '#94a3b8');

      // Generator dynamo input gear (small yellow 8-tooth pinion - rotates 3x faster with opposite rotation!)
      const generatorGearAngle = -gearRotation * 3.0;
      drawSystemGear(segments.generator.x + 6, segments.generator.y + 8, 11, 8, generatorGearAngle, '#64748b');

      // Technic Generator System Body (with copper spool graphics)
      drawComponent(segments.generator.x, segments.generator.y, segments.generator.w, segments.generator.h, '#475569', '#334155', 'DYNAMO');

      // 5. Draw Condenser and Cooling Tower
      drawComponent(segments.condenser.x, segments.condenser.y, segments.condenser.w, segments.condenser.h, '#1e293b', '#0f172a', 'CONDENSER');
      
      // Giant cooling tower cylindrical outline (classic Hyperbolic system brick built shape)
      ctx.fillStyle = '#334155';
      const ctxTowerX = segments.coolingTower.x * sX;
      const ctxTowerY = segments.coolingTower.y * sY;
      const ctxTowerW = segments.coolingTower.w * sX;
      const ctxTowerH = segments.coolingTower.h * sY;
      
      ctx.beginPath();
      ctx.moveTo(ctxTowerX + 8, ctxTowerY);
      ctx.bezierCurveTo(ctxTowerX + 16, ctxTowerY + ctxTowerH / 2, ctxTowerX + 4, ctxTowerY + ctxTowerH / 2, ctxTowerX, ctxTowerY + ctxTowerH);
      ctx.lineTo(ctxTowerX + ctxTowerW, ctxTowerY + ctxTowerH);
      ctx.bezierCurveTo(ctxTowerX + ctxTowerW - 4, ctxTowerY + ctxTowerH / 2, ctxTowerX + ctxTowerW - 16, ctxTowerY + ctxTowerH / 2, ctxTowerX + ctxTowerW - 8, ctxTowerY);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Horizontal red stripe representing warning signal bands
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ctxTowerX + 10, ctxTowerY + 25, ctxTowerW - 20, 8);

      // 6. Draw active particles on the canvas
      particles.forEach(p => {
        ctx.fillStyle = p.color;
        
        ctx.beginPath();
        if (p.type === 'neutron') {
          // Glow effect around high energy neutrons
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.arc(p.x * sX, p.y * sY, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        } else if (p.type === 'steam') {
          // Circular textured steam cloud puff
          ctx.globalAlpha = p.life * 0.45;
          ctx.arc(p.x * sX, p.y * sY, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        } else if (p.type === 'power_spark') {
          // Jagged electricity spark
          ctx.fillRect(p.x * sX, p.y * sY, p.size * 2, p.size * 3);
        } else {
          ctx.arc(p.x * sX, p.y * sY, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 7. Render comic text popups (FISSION SPLATS!)
      fissionAnimations.forEach((f, index) => {
        f.life -= delta * 1.8;
        
        ctx.save();
        ctx.translate(f.x * sX, f.y * sY);
        ctx.scale(1 + (1 - f.life) * 0.3, 1 + (1 - f.life) * 0.3);
        
        // Clean data ring
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();

        // Split text label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'black 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, 0, 3);
        
        ctx.restore();
      });

      // Purge dead fission texts
      for (let i = fissionAnimations.length - 1; i >= 0; i--) {
        if (fissionAnimations[i].life <= 0) {
          fissionAnimations.splice(i, 1);
        }
      }

      // ==========================================================
      // 8. COCKPIT HOLOGRAPHIC TECH-GRID DIAGRAMS (HUD OVERLAY)
      // ==========================================================
      
      // Upper Left: Science & Control Room Telemetry
      ctx.fillStyle = 'rgba(11, 12, 16, 0.85)';
      ctx.strokeStyle = 'rgba(207, 164, 93, 0.6)';
      ctx.lineWidth = 1.5;
      
      const hudX = 15;
      const hudY = 15;
      const hudW = 215;
      const hudH = 95;
      
      ctx.beginPath();
      ctx.moveTo(hudX, hudY);
      ctx.lineTo(hudX + hudW - 15, hudY);
      ctx.lineTo(hudX + hudW, hudY + 15);
      ctx.lineTo(hudX + hudW, hudY + hudH);
      ctx.lineTo(hudX, hudY + hudH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Box Title
      ctx.fillStyle = '#cfa45d';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(isFusion ? '▲ THERMONUCLEAR TOKAMAK HUD' : '▲ FISSION DECK COCKPIT HUD', hudX + 11, hudY + 14);
      
      // Divider
      ctx.strokeStyle = 'rgba(207, 164, 93, 0.25)';
      ctx.beginPath();
      ctx.moveTo(hudX + 10, hudY + 22);
      ctx.lineTo(hudX + hudW - 10, hudY + 22);
      ctx.stroke();
      
      if (isFusion) {
        // Fusion HUD values
        // Q Gain Factor
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText('FUSION GAIN METRIC (Q-ratio):', hudX + 11, hudY + 34);
        
        const qVal = currentState.fusionGain || 0;
        const qColor = qVal >= 1.0 ? '#10b981' : qVal >= 0.5 ? '#475569' : '#a1a1aa';
        ctx.fillStyle = qColor;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(qVal.toFixed(2), hudX + 11, hudY + 47);
        
        let qStateLabel = 'Q < 1.0 (ENERGY CONSUMING)';
        if (qVal >= 5.0) {
          qStateLabel = 'IGNITION ACCELERATION!';
        } else if (qVal >= 1.0) {
          qStateLabel = 'NET FUSION COMMENCED!';
        }
        ctx.font = 'bold 7px monospace';
        ctx.fillText(qStateLabel, hudX + 50, hudY + 46);
        
        // Plasma Confinement Energy (tau_E)
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText('MAGNET CONFINEMENT TIME (tau_E):', hudX + 11, hudY + 62);
        
        const tauVal = currentState.confinementTime || 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(hudX + 11, hudY + 68, hudW - 55, 6);
        ctx.fillStyle = '#ec4899'; // magnetic fusia color
        ctx.fillRect(hudX + 11, hudY + 68, Math.min(hudW - 55, (hudW - 55) * (tauVal / 2.0)), 6);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = '#f472b6';
        ctx.strokeRect(hudX + 11, hudY + 68, hudW - 55, 6);
        
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 8.5px monospace';
        ctx.fillText(`${tauVal.toFixed(2)}s`, hudX + hudW - 38, hudY + 74);

        ctx.fillStyle = '#e879f9';
        ctx.font = '500 9px monospace';
        ctx.fillText('⚡ MICROWAVE WAVEGUIDES: EMITTING', hudX + 11, hudY + 86);
      } else {
        // Ke-effective
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText('REACTIVITY DELTA (keff):', hudX + 11, hudY + 34);
        
        const kColor = localKEffective > 1.025 ? '#f43f5e' : localKEffective > 0.985 ? '#10b981' : '#a1a1aa';
        ctx.fillStyle = kColor;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(localKEffective.toFixed(3), hudX + 11, hudY + 47);
        
        // Multiplier status label
        let kStateLabel = 'SUBCRITICAL (QUENCH)';
        if (localKEffective >= 0.985 && localKEffective <= 1.025) {
          kStateLabel = 'CRITICAL (BALANCED)';
        } else if (localKEffective > 1.025) {
          kStateLabel = 'SUPERCRITICAL (GROWTH)';
        }
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText(kStateLabel, hudX + 56, hudY + 46);
        
        // Xenon-135 Poison Level
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText('XENON-135 ATOMIC SPONGE PIT:', hudX + 11, hudY + 62);
        
        // Progress bar tracks for Xenon chemical dampening
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(hudX + 11, hudY + 68, hudW - 55, 6);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(hudX + 11, hudY + 68, (hudW - 55) * (localXenonLevel / 100), 6);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = '#60a5fa';
        ctx.strokeRect(hudX + 11, hudY + 68, hudW - 55, 6);
        
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 8.5px monospace';
        ctx.fillText(`${localXenonLevel.toFixed(1)}%`, hudX + hudW - 38, hudY + 74);

        ctx.fillStyle = '#22d3ee';
        ctx.font = '500 9px monospace';
        ctx.fillText('⚡ TACTICAL INJECT BUTTONS: ACTIVE', hudX + 11, hudY + 86);
      }

      // Upper Right: Rotating scopes and live target targeting details
      if (hoverRef.current) {
        const hx = hoverRef.current.x;
        const hy = hoverRef.current.y;
        
        ctx.fillStyle = 'rgba(11, 12, 16, 0.88)';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.2;
        
        const infoX = dimensions.width - 240;
        const infoY = 15;
        const infoW = 225;
        const infoH = 68;
        
        ctx.beginPath();
        ctx.moveTo(infoX + 15, infoY);
        ctx.lineTo(infoX + infoW, infoY);
        ctx.lineTo(infoX + infoW, infoY + infoH);
        ctx.lineTo(infoX, infoY + infoH);
        ctx.lineTo(infoX, infoY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('▲ INTERACTION DECK RADAR', infoX + 12, infoY + 14);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText(`HOVER COORD: Grid X:${hx.toFixed(0)} Y:${hy.toFixed(0)}`, infoX + 12, infoY + 26);
        
        // Define targeted zones dynamically
        let sysTitle = 'VACUUM CONTAINER GRID';
        let actionTipText = 'CLICK MODULES FOR MECHANICAL FORCE';
        let customNeonColor = '#64748b';
        
        const inCore = hx >= segments.core.x && hx <= (segments.core.x + segments.core.w) &&
                       hy >= segments.core.y && hy <= (segments.core.y + segments.core.h);
                       
        const inTurbine = hx >= segments.turbine.x && hx <= (segments.turbine.x + segments.turbine.w) &&
                          hy >= segments.turbine.y && hy <= (segments.turbine.y + segments.turbine.h);

        const inCondenser = hx >= segments.condenser.x && hx <= (segments.condenser.x + segments.condenser.w) &&
                            hy >= segments.condenser.y && hy <= (segments.condenser.y + segments.condenser.h);

        const inGenerator = hx >= segments.generator.x && hx <= (segments.generator.x + segments.generator.w) &&
                            hy >= segments.generator.y && hy <= (segments.generator.y + segments.generator.h);
        
        if (inCore) {
          sysTitle = 'U-235 ATOMIC FUEL CORE VESSEL';
          actionTipText = '🎯 CLICK TO FIRE NEUTRON PISTOL!';
          customNeonColor = '#fca5a5';
        } else if (inTurbine) {
          sysTitle = 'systemS TEAM STEAM SPUR TURBINE';
          actionTipText = '⚙️ CLICK TO MANUALLY SPIN TURBINE RPM!';
          customNeonColor = '#c084fc';
        } else if (inCondenser) {
          sysTitle = 'WATER COLLATER CONVERTER CONDENSER';
          actionTipText = '💧 CLICK TO PRIME IMPELLER PUMP VOLTS';
          customNeonColor = '#22d3ee';
        } else if (inGenerator) {
          sysTitle = 'COPPER SPOOL DYNAMO COILS';
          actionTipText = '⚡ CLICK TO INDUCT INSTANT KWH SPARK!';
          customNeonColor = '#fbbf24';
        }
        
        ctx.fillStyle = customNeonColor;
        ctx.font = '500 9px monospace';
        ctx.fillText(sysTitle, infoX + 12, infoY + 38);
        
        ctx.fillStyle = '#f8fafc';
        ctx.font = '500 9px monospace';
        ctx.fillText(actionTipText, infoX + 12, infoY + 52);
        
        // Render targeting ring reticle directly over canvas mouse coordinates!
        ctx.save();
        ctx.translate(hx * sX, hy * sY);
        ctx.rotate((performance.now() / 320) % (Math.PI * 2));
        ctx.strokeStyle = customNeonColor;
        ctx.lineWidth = 1.4;
        
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-18, 0); ctx.lineTo(-9, 0);
        ctx.moveTo(9, 0); ctx.lineTo(18, 0);
        ctx.moveTo(0, -18); ctx.lineTo(0, -9);
        ctx.moveTo(0, 9); ctx.lineTo(0, 18);
        ctx.stroke();
        
        ctx.restore();
      } else {
        // Transparent default interaction reminder bar
        ctx.fillStyle = 'rgba(11, 12, 16, 0.45)';
        ctx.strokeStyle = 'rgba(207, 164, 93, 0.12)';
        ctx.lineWidth = 1;
        
        const tipBannerX = dimensions.width - 245;
        const tipBannerY = 15;
        ctx.fillRect(tipBannerX, tipBannerY, 230, 24);
        ctx.strokeRect(tipBannerX, tipBannerY, 230, 24);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ HOVER & CLICK DEVICES TO MANIPULATE GRID 🎯', tipBannerX + 115, tipBannerY + 15);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(runLoop);
    };

    animationFrameId = requestAnimationFrame(runLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [dimensions]);

  return (
    <div id="sim-canvas-viewport" ref={containerRef} className="w-full relative bg-[#0b0c10] border-4 border-amber-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-end">
      {/* Outer gold-rimmed borders and Cherenkov alert indicators */}
      <div className={`absolute inset-0 border-6 transition-all duration-300 pointer-events-none z-30 rounded-2xl ${
        simState.reactorStatus === 'OVERHEATING' ? 'border-amber-600 animate-pulse' :
        simState.reactorStatus === 'MELTDOWN' ? 'border-red-600 animate-pulse' :
        simState.scramActive ? 'border-blue-500' : 'border-[#cfa45d]/40'
      }`} />

      {/* Actual HTML Canvas element */}
      <canvas
        id="nuclear-fission-system-canvas"
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        className="w-full h-full block relative z-10 cursor-crosshair"
      />

      {/* Absolute overlay elements (Alarm state indicator bars) */}
      {(simState.reactorStatus === 'OVERHEATING' || simState.meltdownDanger > 70) && (
        <div className="absolute top-2.5 left-2.5 bg-red-600 text-gray-950 font-mono text-xs font-black tracking-widest px-3 py-1 rounded-md z-40 animate-pulse border-2 border-red-400/50 shadow flex items-center gap-1.5 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping inline-block" />
          CORE CORE CRITICAL MELTDOWN WARNING!
        </div>
      )}
    </div>
  );
}
