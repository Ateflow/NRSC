/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ReactMode = 'PWR' | 'BWR';
export type ModeratorType = 'Water' | 'Graphite';
export type ReactorType = 'FISSION' | 'FUSION';

export interface SystemComponent {
  id: string;
  name: string;
  category: 'core' | 'coolant' | 'turbine' | 'cooling' | 'magnet' | 'injector';
  icon: string; // lucide icon identifier
  description: string;
  targetX: number; // grid columns, 0-11
  targetY: number; // grid rows, 0-7
  isPlaced: boolean;
  color: string; // Tailwind class
  componentShape: 'brick' | 'plate' | 'rod' | 'gear' | 'cylinder';
  width: number; // in grid cells
  height: number; // in grid cells
}

export interface SimulationState {
  isAssembled: boolean;
  reactorType: ReactorType;
  coolantType: ReactMode;
  moderatorType: ModeratorType;
  controlRodPosition: number; // 0 (withdrawn) to 100 (fully inserted / SCRAM)
  pumpSpeed: number; // 0 to 100%
  scramActive: boolean;
  soundEnabled: boolean;
  autoMode: boolean;
  
  // Fusion-specific simulation dials
  magneticField: number; // 0 to 100% (Toroidal Coils field power)
  auxiliaryHeating: number; // 0 to 120 MW (NBI and RF Heating)
  tritiumInjection: number; // 0 to 100% (Fuel mix)
  confinementTime: number; // in seconds (tau_E)
  plasmaDensity: number; // in 10^19 per m^3
  plasmaTemperature: number; // in Million Kelvin (MK)
  fusionGain: number; // Q-factor
  
  // Dynamic parameters calculated each tick
  fissionRate: number; // 0% to 200% (high is danger)
  temperature: number; // 20°C to 1200°C
  pressure: number; // 1 bar to 160 bar
  steamGeneration: number; // 0 to 100%
  turbineRPM: number; // 0 to 3600 RPM
  powerOutput: number; // 0 to 1000 Megawatts (MW)
  efficiency: number; // 0 to 100%
  meltdownDanger: number; // 0 to 100%
  totalElectricityProduced: number; // Cumulative kilowatt hours (KWh)
  
  // Interactive UI logs
  reactorStatus: 'OFF' | 'STARTING' | 'OPTIMAL' | 'OVERHEATING' | 'SCRAMMED' | 'MELTDOWN' | 'STABLE_PLASMA' | 'DISRUPTION_MELT' | 'PLASMA_QUENCH';
  activeNarration: string;
  activeNarrationType: 'info' | 'warning' | 'success' | 'epic';
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'neutron' | 'steam' | 'water_flow' | 'power_spark' | 'explosion_spark' | 'deuterium' | 'tritium' | 'alpha' | 'magnetic_flux';
  life: number; // 0 to 1
  size: number;
  color: string;
}

export interface NarratorQuote {
  text: string;
  mood: 'critical' | 'educational' | 'epic' | 'warning' | 'sarcastic';
}
