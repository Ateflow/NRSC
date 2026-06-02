/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SimulationState, ReactMode, ModeratorType } from '../types';
import { 
  ShieldAlert, 
  Settings, 
  Zap, 
  Flame, 
  Gauge, 
  Thermometer, 
  Play,
  Pause,
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Compass, 
  Sparkles,
  Award
} from 'lucide-react';
import { reactorAudio } from './AudioEngine';

interface SimulationControlsProps {
  state: SimulationState;
  onUpdateState: (params: Partial<SimulationState>) => void;
  onReset: () => void;
}

export default function SimulationControls({
  state,
  onUpdateState,
  onReset,
}: SimulationControlsProps) {

  const isFusion = state.reactorType === 'FUSION';

  const handleControlRodChange = (val: number) => {
    if (state.scramActive) return; // ignore control rod inputs during active emergency SCRAM
    onUpdateState({ controlRodPosition: val });
    if (state.soundEnabled) {
      reactorAudio.playClick();
    }
  };

  const handlePumpSpeedChange = (val: number) => {
    onUpdateState({ pumpSpeed: val });
    if (state.soundEnabled) {
      reactorAudio.playClick();
    }
  };

  const handleCoolantToggle = (mode: ReactMode) => {
    onUpdateState({ coolantType: mode });
    if (state.soundEnabled) {
      reactorAudio.playSnap();
    }
  };

  const triggerSCRAM = () => {
    const nextScram = !state.scramActive;
    
    if (nextScram) {
      // Emergency Core SCRAM!
      if (state.soundEnabled) {
        reactorAudio.playScramSound();
        reactorAudio.setAlarmActive(false); // alarms overridden by SCRAM
      }
      onUpdateState({ 
        scramActive: true, 
        controlRodPosition: 100, // force fully inserted
        pumpSpeed: 100, // force high speed cooling
        reactorStatus: 'SCRAMMED',
        activeNarration: "SCRAM TRIGGERED! Boron absorbers inserted 100% manually. Fission chain reaction dampened.",
        activeNarrationType: 'info'
      });
    } else {
      // Manual reset SCRAM
      if (state.soundEnabled) {
        reactorAudio.playSnap();
      }
      onUpdateState({ 
        scramActive: false,
        controlRodPosition: 20, // default warm reset
        reactorStatus: 'STARTING',
        activeNarration: "SCRAM latch released. Re-arming primary neutron sources for starting ignition.",
        activeNarrationType: 'info'
      });
    }
  };

  const toggleSoundWrapper = () => {
    const nextState = !state.soundEnabled;
    onUpdateState({ soundEnabled: nextState });
    reactorAudio.toggleSound(nextState);
  };

  // Status visual color formatting
  const getStatusBadgeClass = () => {
    switch (state.reactorStatus) {
      case 'MELTDOWN': return 'bg-red-950 border-red-500 text-red-500 animate-pulse';
      case 'OVERHEATING': return 'bg-blue-950 border-orange-500 text-orange-400 animate-pulse';
      case 'SCRAMMED': return 'bg-blue-950 border-blue-600 text-blue-400';
      case 'OPTIMAL': return 'bg-emerald-950 border-emerald-500 text-emerald-400';
      case 'STARTING': return 'bg-violet-950 border-violet-500 text-violet-400';
      default: return 'bg-slate-900 border-gray-700 text-gray-400';
    }
  };

  return (
    <div id="simulation-dashboard" className="bg-[#0f172a] border-3 border-cyan-500 rounded-2xl p-5 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-6">
      
      {/* Decorative metal rivets overlays */}
      <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-slate-600/30 shadow-inner" />
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-slate-600/30 shadow-inner" />
      <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-slate-600/30 shadow-inner" />
      <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-slate-600/30 shadow-inner" />

      {/* LEFT SUBPANEL: Live Telemetry Gauges */}
      <div id="telemetry-panel" className="md:col-span-12 lg:col-span-5 space-y-4">
        <h3 className="text-sm font-mono uppercase tracking-widest text-cyan-500 font-bold border-b border-gray-800 pb-2 flex items-center gap-1.5">
          <Gauge className="w-4.5 h-4.5" /> {isFusion ? "Tokamak Telemetry Grid" : "Core Telemetry Grid"}
        </h3>

        {/* Reactor Status indicator block */}
        <div className={`p-3 rounded-xl border flex items-center justify-between shadow ${getStatusBadgeClass()}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 animate-spin-slow" />
            <div>
              <div className="text-[10px] font-mono uppercase text-gray-400">Current Phase</div>
              <div className="text-base font-sans font-bold tracking-tight uppercase">{state.reactorStatus || 'OFF'}</div>
            </div>
          </div>
          {state.scramActive && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700 animate-pulse">{isFusion ? "COIL QUENCH" : "EMERGENCY SCRAM"}</span>
          )}
        </div>

        {/* Technical readings dashboard */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Core Temp Gauge */}
          <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800 flex flex-col justify-between">
            <span className="text-xxs font-mono uppercase text-gray-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-orange-400" /> {isFusion ? "Plasma Temp" : "Temperature"}
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-xl font-mono font-bold tracking-tight ${
                isFusion
                  ? (state.plasmaTemperature > 80 ? 'text-indigo-500 font-extrabold animate-pulse' : state.plasmaTemperature > 30 ? 'text-emerald-400' : 'text-blue-200')
                  : (state.temperature > 850 ? 'text-red-500 font-extrabold' : state.temperature > 600 ? 'text-orange-400' : 'text-blue-200')
              }`}>
                {isFusion ? `${state.plasmaTemperature || state.temperature} MK` : `${state.temperature}°C`}
              </span>
            </div>
            <div className="text-[8px] font-mono text-cyan-500 border-t border-gray-800/80 pt-1 mt-1">
              {isFusion ? "Optimal: ~45 MK" : "Limit: 1200°C"}
            </div>
          </div>

          {/* Steam Pressure Gauge */}
          <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800 flex flex-col justify-between">
            <span className="text-xxs font-mono uppercase text-gray-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-cyan-400" /> {isFusion ? "Plasma Density" : "Pressure"}
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-teal-300 tracking-tight">
                {isFusion ? `${state.plasmaDensity || 1.1} Trill/m³` : `${state.pressure} bar`}
              </span>
            </div>
            <div className="text-[8px] font-mono text-cyan-500 border-t border-gray-800/80 pt-1 mt-1">
              {isFusion ? "Limit: 3.5x10²⁰" : "Limit: 155 bar"}
            </div>
          </div>

          {/* Turbine speed Gauge */}
          <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800 flex flex-col justify-between">
            <span className="text-xxs font-mono uppercase text-gray-400 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin-slow" /> Turbine Status
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-purple-300 tracking-tight">{state.turbineRPM} RPM</span>
            </div>
            <div className="text-[8px] font-mono text-cyan-500 border-t border-gray-800/80 pt-1 mt-1">
              {isFusion ? "Lithium blanket steam loops" : `Ratio: ${state.coolantType === 'PWR' ? '2.5x Gears' : 'Direct Loop'}`}
            </div>
          </div>

          {/* Live Electricity Output (MW) */}
          <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-800 flex flex-col justify-between">
            <span className="text-xxs font-mono uppercase text-gray-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" /> Grid Output
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-yellow-400 tracking-tight">{state.powerOutput} MW</span>
            </div>
            <div className="text-[8px] font-mono text-cyan-500 border-t border-gray-800/80 pt-1 mt-1">
              {isFusion ? `Q gain: ${state.fusionGain?.toFixed(2)}` : `Efficiency: ${state.efficiency}%`}
            </div>
          </div>

        </div>

        {/* Block energy output counter card */}
        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
              <Award className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">Total Substation Yield</div>
              <div className="text-base font-sans font-bold text-white tracking-tight">
                {Math.floor(state.totalElectricityProduced).toLocaleString()} <span className="text-blue-400 text-xs">MWh</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-blue-500 font-bold bg-[#14151a] px-2.5 py-1 rounded shadow-inner border border-blue-500/20">
            {Math.round(state.totalElectricityProduced / 12)} Households
          </span>
        </div>

      </div>

      {/* RIGHT SUBPANEL: Custom tactile dials and buttons */}
      <div id="tactile-controls-panel" className="md:col-span-7 space-y-4">
        
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <h3 className="text-sm font-mono uppercase tracking-widest text-cyan-500 font-bold flex items-center gap-1.5">
            <Settings className="w-4.5 h-4.5 text-blue-500" /> Control Parameters
          </h3>
          
          {/* Top utilities: Audio, Auto Mode & Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateState({ autoMode: !state.autoMode })}
              className={`py-1.5 px-3 rounded-lg border cursor-pointer font-bold font-mono text-[10px] uppercase transition-all tracking-wider flex items-center gap-1.5 ${
                state.autoMode 
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md shadow-blue-950/20' 
                  : 'bg-emerald-500/20 border-emerald-500 text-emerald-300 hover:bg-emerald-500/30 shadow-md shadow-emerald-950/20'
              }`}
            >
              {state.autoMode ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {state.autoMode ? 'Auto-Sim Running' : 'Play Auto-Sim'}
            </button>

            <button
              id="audio-toggle-controls"
              onClick={toggleSoundWrapper}
              className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                state.soundEnabled 
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' 
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-400'
              }`}
              title={state.soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            >
              {state.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              id="reset-simulation-btn"
              onClick={onReset}
              className="p-1.5 rounded-lg border border-gray-700 hover:border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white cursor-pointer flex items-center gap-1 text-[10px] font-mono uppercase"
              title="Reset Reactor Configuration"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Reactor coolant model selector BWR vs PWR */}
        {isFusion ? (
          <div>
            <span className="text-xxs font-mono uppercase text-gray-400 block mb-2 font-bold tracking-wider">
              Plasma Fuel Isotope Mixture
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="dd-mode-select"
                onClick={() => {
                  onUpdateState({ coolantType: 'BWR', tritiumInjection: 20 });
                  if (state.soundEnabled) reactorAudio.playSnap();
                }}
                className={`py-2 px-3 rounded-xl border font-sans font-bold text-xs flex flex-col justify-start text-left cursor-pointer transition-all ${
                  state.coolantType === 'BWR'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/20 ring-1 ring-cyan-500/30'
                    : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 text-gray-400 hover:border-gray-700'
                }`}
              >
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-black">D-D Isotope</span>
                <span className="text-[9px] mt-0.5 opacity-90 font-normal">Pure Deuterium. Highly steady, zero radioactive tritium breeding, lower cross section.</span>
              </button>

              <button
                id="dt-mode-select"
                onClick={() => {
                  onUpdateState({ coolantType: 'PWR', tritiumInjection: 100 });
                  if (state.soundEnabled) reactorAudio.playSnap();
                }}
                className={`py-2 px-3 rounded-xl border font-sans font-bold text-xs flex flex-col justify-start text-left cursor-pointer transition-all ${
                  state.coolantType === 'PWR'
                    ? 'bg-indigo-500/10 border-indigo-500 text-pink-200 shadow-md shadow-pink-950/20 ring-1 ring-indigo-500/30'
                    : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 text-gray-400 hover:border-gray-700'
                }`}
              >
                <span className="text-[10px] font-mono text-pink-400 uppercase font-black">D-T Tritium Isotope</span>
                <span className="text-[9px] mt-0.5 opacity-90 font-normal">Supercharged Deuterium-Tritium mix. Breaches break-even margin easily with immense surplus heat.</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <span className="text-xxs font-mono uppercase text-[#94a3b8] block mb-2 font-bold tracking-wider">
              Primary Cooling System
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="pwr-mode-select"
                onClick={() => handleCoolantToggle('PWR')}
                className={`py-2 px-3 rounded-xl border font-sans font-bold text-xs flex flex-col justify-start text-left cursor-pointer transition-all ${
                  state.coolantType === 'PWR'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-200 shadow-md shadow-sky-950/20 ring-1 ring-sky-500/30'
                    : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 text-gray-400 hover:border-gray-700'
                }`}
              >
                <span className="text-[10px] font-mono text-sky-400 uppercase font-black">PWR Mode</span>
                <span className="text-[9px] mt-0.5 opacity-90 font-normal">Superheated primary water loops through physical Boiler. Radiation isolated.</span>
              </button>

              <button
                id="bwr-mode-select"
                onClick={() => handleCoolantToggle('BWR')}
                className={`py-2 px-3 rounded-xl border font-sans font-bold text-xs flex flex-col justify-start text-left cursor-pointer transition-all ${
                  state.coolantType === 'BWR'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-200 shadow-md shadow-purple-950/20 ring-1 ring-purple-500/30'
                    : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 text-gray-400 hover:border-gray-700'
                }`}
              >
                <span className="text-[10px] font-mono text-purple-400 uppercase font-black">BWR Mode</span>
                <span className="text-[9px] mt-0.5 opacity-90 font-normal">Core cooling water boils directly inside. Radioactive steam spins generator directly.</span>
              </button>
            </div>
          </div>
        )}

        {/* Sliders Grid */}
        {isFusion ? (
          <div className="space-y-4 bg-gray-900/20 p-3 rounded-xl border border-gray-800/80">
            
            {/* SLIDER 1: TOKAMAK COIL MAGNETIC FIELD strength */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xxs font-mono uppercase text-gray-300 font-bold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow animate-pulse" />
                  Toroidal Magnet Field (B)
                </span>
                <span className="text-xxs font-mono font-bold text-pink-400">
                  {state.magneticField} Tesla / 10 T {state.magneticField > 8.5 ? '(MAX FIELD SHIELDING)' : ''}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xxs font-mono text-gray-500 italic">0 T (Quench)</span>
                <input
                  id="magnetic-field-slider"
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={state.magneticField}
                  onChange={(e) => {
                    onUpdateState({ magneticField: parseFloat(e.target.value) });
                    if (state.soundEnabled) reactorAudio.playClick();
                  }}
                  disabled={state.scramActive}
                  className="flex-grow h-2.5 bg-gray-800 hover:bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-indigo-500 border border-gray-700 disabled:opacity-50"
                />
                <span className="text-xxs font-mono text-gray-500 italic">10 T (Max Compression)</span>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                 Confined magnetic solenoid field compresses hot plasma. Dropping magnets below 4.5 T triggers disruptive plasma wall collapse!
              </p>
            </div>

            {/* SLIDER 2: AUXILIARY MICROWAVE BEAM HEATING */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xxs font-mono uppercase text-gray-300 font-bold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow animate-pulse" />
                  Aux RF Antenna Waves (P_aux)
                </span>
                <span className="text-xxs font-mono font-bold text-blue-400">
                  {state.auxiliaryHeating} MW / 100 MW
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xxs font-mono text-gray-500 italic">Off</span>
                <input
                  id="aux-heating-slider"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={state.auxiliaryHeating}
                  onChange={(e) => {
                    onUpdateState({ auxiliaryHeating: parseInt(e.target.value) });
                    if (state.soundEnabled) reactorAudio.playClick();
                  }}
                  className="flex-grow h-2.5 bg-gray-800 hover:bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-blue-500 border border-gray-700"
                />
                <span className="text-xxs font-mono text-gray-500 italic">Full Wave Power</span>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                Gigahertz RF antennas shoot electromagnetic beams to cook the fusion atoms to active thermonuclear temperatures (minimum ~30MK).
              </p>
            </div>

            {/* SLIDER 3: LITHIUM BLANKET COOLANT PUMP speed */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xxs font-mono uppercase text-gray-300 font-bold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow animate-pulse" />
                  Lithium Blanket Loop Speed
                </span>
                <span className="text-xxs font-mono font-bold text-teal-400">
                  {state.pumpSpeed}% flow
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xxs font-mono text-gray-500 italic">Stagnant</span>
                <input
                  id="pump-cooling-slider-f"
                  type="range"
                  min="15"
                  max="100"
                  value={state.pumpSpeed}
                  onChange={(e) => handlePumpSpeedChange(parseInt(e.target.value))}
                  className="flex-grow h-2.5 bg-gray-800 hover:bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-teal-400 border border-gray-700"
                />
                <span className="text-xxs font-mono text-gray-500 italic">Max Sweeping Speed</span>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                Sweeping coolant carries the net thermonuclear heat. If coolant speed is too low with active fusion, the vessel wall tiles melt!
              </p>
            </div>

          </div>
        ) : (
          <div className="space-y-4 bg-gray-900/20 p-3 rounded-xl border border-gray-800/80">
            
            {/* SLIDER 1: BORON CONTROL RODS */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xxs font-mono uppercase text-gray-300 font-bold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow animate-pulse" />
                  Boron Control Rod Depth
                </span>
                <span className="text-xxs font-mono font-bold text-orange-400">
                  {state.controlRodPosition === 100 ? '100% (SCRAMMED)' : state.controlRodPosition === 0 ? '0% (MAX TEMPERATURE)' : `${state.controlRodPosition}%`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xxs font-mono text-gray-500 italic">Withdrawn</span>
                <input
                  id="control-rod-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={state.controlRodPosition}
                  onChange={(e) => handleControlRodChange(parseInt(e.target.value))}
                  disabled={state.scramActive}
                  className="flex-grow h-2.5 bg-gray-800 hover:bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-orange-500 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xxs font-mono text-gray-500 italic">Absorb All</span>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                 Boron rods soak up thermal neutrons. Lower rods to raise fission; raise them to reduce core reactivity.
              </p>
            </div>

            {/* SLIDER 2: PRIMARY COOLING WATER PUMP (RPM) */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xxs font-mono uppercase text-gray-300 font-bold tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow animate-pulse" />
                  Primary Pump Flow RPM
                </span>
                <span className="text-xxs font-mono font-bold text-cyan-400">
                  {state.pumpSpeed === 100 ? '100% MAXIMUM COOLING' : `${state.pumpSpeed}% speed`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xxs font-mono text-gray-500 italic">Stagnant</span>
                <input
                  id="pump-cooling-slider"
                  type="range"
                  min="10"
                  max="100"
                  value={state.pumpSpeed}
                  onChange={(e) => handlePumpSpeedChange(parseInt(e.target.value))}
                  className="flex-grow h-2.5 bg-gray-800 hover:bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-gray-700"
                />
                <span className="text-xxs font-mono text-gray-500 italic">Max RPM</span>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                Coolant speed captures core heat. Low pump speeds with active fission will trigger safety meltdown phases!
              </p>
            </div>

          </div>
        )}

        {/* E-Emergency Core-Cutoff SCRAM Switch */}
        <div className="pt-2">
          <button
            id="emergency-scram-toggle"
            onClick={triggerSCRAM}
            className={`w-full py-3.5 px-4 rounded-xl font-sans tracking-widest font-black uppercase shadow-lg border text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 transform hover:scale-[1.01] active:scale-95 ${
              state.scramActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40 shadow-emerald-900/20'
                : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white border-red-400/50 shadow-red-950/40'
            }`}
          >
            <ShieldAlert className="w-5 h-5 fill-current animate-pulse" />
            {isFusion ? (
              state.scramActive ? 'RE-IGNITE PLASMA CHAMBER (CHARGE COILS)' : '⚠️ TRIGGER MAGNETIC COIL QUENCH (EXTINGUISH COILS) ⚠️'
            ) : (
              state.scramActive ? 'NORMALIZE REACTOR (ARM CORE)' : '⚠️ MASSIVE EMERGENCY SCRAM CORE ⚠️'
            )}
          </button>
        </div>

      </div>

    </div>
  );
}
