/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SimulationState } from './types';
import { reactorAudio } from './components/AudioEngine';
import { motion, AnimatePresence } from 'motion/react';
import SimulationCanvas from './components/SimulationCanvas';
import SimulationControls from './components/SimulationControls';
import TelemetryConsole from './components/TelemetryConsole';
import { 
  Atom, 
  Wrench, 
  Tv, 
  Flame, 
  BookOpen, 
  Play, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  Volume2,
  VolumeX,
  Gauge
} from 'lucide-react';



const INITIAL_SIM_STATE: SimulationState = {
  isAssembled: true,
  reactorType: 'FISSION',
  coolantType: 'PWR',
  moderatorType: 'Water',
  controlRodPosition: 30, // partially inserted
  pumpSpeed: 75, // standard starting cooling
  scramActive: false,
  soundEnabled: true,
  autoMode: true,
  
  // Fusion-specific simulation dials
  magneticField: 80, // initial toroidal magnetic field
  auxiliaryHeating: 45, // auxiliary heating MW
  tritiumInjection: 55, // fuel mix
  confinementTime: 1.15, // standard baseline
  plasmaDensity: 5.4, // density coefficient
  plasmaTemperature: 85, // million Kelvin
  fusionGain: 0.95, // close to Q=1 break-even
  
  fissionRate: 15,
  temperature: 340,
  pressure: 48,
  steamGeneration: 22,
  turbineRPM: 1400,
  powerOutput: 388,
  efficiency: 78,
  meltdownDanger: 0,
  totalElectricityProduced: 125,
  
  reactorStatus: 'OPTIMAL',
  activeNarration: "Initialization sequence completed. The systems are functioning normally. Try interacting directly inside the containment reactor block to release active neutrons or manage control rods.",
  activeNarrationType: 'success'
};

export default function App() {
  const [simState, setSimState] = useState<SimulationState>(INITIAL_SIM_STATE);
  const [showGuideDrawer, setShowGuideDrawer] = useState(false);

  // Synchronize audio on mount or state change
  useEffect(() => {
    // Initial sound engine setup
    reactorAudio.toggleSound(simState.soundEnabled);
    return () => {
      reactorAudio.toggleSound(false);
    };
  }, []);

  const handleResetSimulation = () => {
    setSimState(prev => {
      const isFiss = prev.reactorType === 'FISSION';
      return {
        ...prev,
        controlRodPosition: 30,
        pumpSpeed: 75,
        scramActive: false,
        magneticField: 80,
        auxiliaryHeating: 45,
        tritiumInjection: 55,
        confinementTime: 1.15,
        plasmaDensity: 5.4,
        plasmaTemperature: 85,
        fusionGain: 0.95,
        fissionRate: 0,
        temperature: isFiss ? 20 : 85,
        pressure: isFiss ? 1 : 4,
        steamGeneration: 0,
        turbineRPM: 0,
        powerOutput: 0,
        efficiency: 0,
        meltdownDanger: 0,
        reactorStatus: isFiss ? 'STARTING' : 'STABLE_PLASMA',
        activeNarration: isFiss
          ? "Thermal status recalibrated. Reactor controls reset to safe baseline startup configurations."
          : "Magnetic coil dynamics calibrated. Fusion plasma envelope stabilized to baseline parameters.",
        activeNarrationType: 'info'
      };
    });

    if (simState.soundEnabled) {
      reactorAudio.playSnap();
    }
  };

  const handleUpdateSimParams = (params: Partial<SimulationState>) => {
    setSimState(prev => ({ ...prev, ...params }));
  };

  const handleToggleSound = (enabled: boolean) => {
    setSimState(prev => ({ ...prev, soundEnabled: enabled }));
    reactorAudio.toggleSound(enabled);
  };

  // Automated Simulation Logic
  useEffect(() => {
    if (!simState.autoMode || simState.scramActive || simState.meltdownDanger > 95) return;
    
    // Create an interval to stabilize the reactor every 500ms
    const logicTimer = setInterval(() => {
      setSimState(prev => {
        if (!prev.autoMode || prev.scramActive) return prev;
        
        let updates: Partial<SimulationState> = {};
        
        if (prev.reactorType === 'FISSION') {
          // Adjust rods to maintain temperature ~400-600C
          let newRodPos = prev.controlRodPosition;
          if (prev.temperature > 650) {
            newRodPos = Math.min(100, newRodPos + 5);
          } else if (prev.temperature < 400 && prev.fissionRate < 20) {
            newRodPos = Math.max(0, newRodPos - 5);
          }

          // Adjust pump for cooling
          let newPump = prev.pumpSpeed;
          if (prev.temperature > 500) {
            newPump = Math.min(100, newPump + 4);
          } else if (prev.temperature < 350) {
            newPump = Math.max(20, newPump - 3);
          }
          
          updates = {
            controlRodPosition: newRodPos,
            pumpSpeed: newPump
          };
        } else {
          // Adjust fusion magnetic fields to prevent Quench but avoid overheat
          let newB = prev.magneticField;
          let newAux = prev.auxiliaryHeating;
          let newPump = prev.pumpSpeed;
          
          if (prev.plasmaTemperature < 45) {
            newB = Math.min(10, newB + 0.5);
            newAux = Math.min(100, newAux + 5);
          } else if (prev.plasmaTemperature > 100) {
            newB = Math.max(5, newB - 0.5);
            newAux = Math.max(0, newAux - 5);
          }
          
          if (prev.plasmaTemperature > 80) {
            newPump = Math.min(100, newPump + 5);
          } else {
            newPump = Math.max(40, newPump - 2);
          }
          
          updates = {
            magneticField: newB,
            auxiliaryHeating: newAux,
            pumpSpeed: newPump
          };
        }
        
        return { ...prev, ...updates };
      });
    }, 1000);
    
    return () => clearInterval(logicTimer);
  }, [simState.autoMode, simState.scramActive, simState.meltdownDanger]);

  return (
    <div id="reactor-app-root" className="min-h-screen bg-[#0d0e12] text-gray-100 flex flex-col font-sans selection:bg-blue-500 selection:text-black">
      
      {/* High-contrast Alert banner when meltdownDanger > 80 */}
      <AnimatePresence>
        {simState.meltdownDanger > 80 && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ type: 'spring', stiffness: 150, damping: 18 }}
            className="fixed top-0 left-0 w-full min-h-[96px] sm:min-h-[84px] h-[140px] sm:h-[84px] z-[100] bg-red-600 border-b-4 border-yellow-500 text-white flex items-center shadow-2xl overflow-hidden font-mono px-4 select-none"
          >
            {/* Left stripes */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-8 bg-stripes-yellow-red hidden md:block" 
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fbbf24, #fbbf24 10px, #dc2626 10px, #dc2626 20px)' }} 
            />
            
            <div className="flex-1 flex items-center justify-between gap-4 w-full md:px-12">
              <div className="flex items-center gap-3 shrink-0 animate-bounce">
                <span className="text-2xl sm:text-3xl">🚨</span>
                <span className="hidden sm:inline text-xs font-black bg-yellow-500 text-black px-2 py-1 rounded tracking-tighter">MELTDOWN THREAT</span>
              </div>
              
              {/* Scrolling Marquee text */}
              <div className="flex-grow overflow-hidden flex items-center mx-1 sm:mx-4">
                {React.createElement('marquee', {
                  scrollamount: '14',
                  behavior: 'scroll',
                  direction: 'left',
                  className: 'w-full text-base sm:text-xl font-black tracking-widest text-yellow-300'
                }, simState.reactorType === 'FUSION' 
                  ? "⚠️ CRITICAL PLASMA CONFINEMENT COLLAPSE DETECTED! WALL TEMPERATURES EXCEED DESIGN LIMITS! DETONATION THREAT IMMINENT! SCRAM COILS NOW! ⚠️"
                  : "⚠️ EMERGENCY WARNING: CORE TEMPERATURE EXCEEDS CRITICAL THRESHOLD! RADIATION LEAK PROBABILITY HIGH! ENGAGE MAXIMUM SCRAM SYSTEM NOW! ⚠️"
                )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => {
                    if (simState.reactorType === 'FUSION') {
                      handleUpdateSimParams({ scramActive: true, coolantType: 'BWR', magneticField: 0.5 });
                    } else {
                      handleUpdateSimParams({ scramActive: true, controlRodPosition: 100 });
                    }
                    if (simState.soundEnabled) {
                      reactorAudio.playScramSound();
                    }
                  }}
                  className="bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-black text-xs sm:text-sm px-3.5 py-1.5 sm:py-2 rounded-xl transition-all animate-pulse shadow-md cursor-pointer border-2 border-black tracking-wide uppercase font-black"
                >
                  QUICK SCRAM
                </button>
                <span className="text-2xl sm:text-3xl animate-bounce">🚨</span>
              </div>
            </div>
            
            {/* Right stripes */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-8 bg-stripes-yellow-red hidden md:block" 
              style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #fbbf24, #fbbf24 10px, #dc2626 10px, #dc2626 20px)' }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Top Navigation Header Bar with Gold Border */}
      <header className="bg-[#121319] border-b-3 border-blue-900/50 py-4 px-6 sticky top-0 z-50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Brand Core Label logo and subtitle */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg border border-cyan-400/40 text-gray-950 animate-pulse">
            <Atom className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono tracking-widest px-2 py-0.5 rounded border border-blue-500/30 uppercase font-black">
                SIMULATION LIVE
              </span>
              <span className="text-[9px] text-blue-400 font-mono tracking-wider font-extrabold">TELEMETRY SCADA</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-gray-100">
              Nuclear Reactor Simulation Core
            </h1>
          </div>
        </div>

        {/* Tab Selection Switches */}
        <div className="flex items-center justify-end gap-2 bg-[#1b1c24] border border-gray-800 p-1.5 rounded-2xl w-full sm:w-auto">
          <button
            id="tab-select-sim"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-6 rounded-xl font-sans font-bold text-sm shadow-md transition-all bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          >
            <Tv className="w-4 h-4" /> Systems View
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse border border-gray-950" />
          </button>
        </div>
      </header>

      {/* Main Subscreen container */}
      <main className="flex-grow p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full relative z-10">
        
        {/* Live Simulator room container */}
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 gap-6">
            
            <SimulationCanvas
              simState={simState}
              onUpdateState={handleUpdateSimParams}
            />

            <SimulationControls
              state={simState}
              onUpdateState={handleUpdateSimParams}
              onReset={handleResetSimulation}
            />

          </div>
        </div>

        {/* Narrator text commentary block, always displayed at the bottom of viewport */}
        <TelemetryConsole state={simState} />

        {/* Nuclear Core explanation panel */}
        <section id="atomic-education-deck" className="bg-[#121319] border border-gray-850 rounded-2xl p-5 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900/30 to-slate-950/20">
          <div className="absolute top-0 right-0 p-3 bg-blue-500/5 text-blue-400 rounded-bl-xl border-l border-b border-gray-800 font-mono text-[10px] tracking-wider uppercase font-black">
            System Documentation
          </div>

          <h4 className="text-base font-sans font-black text-gray-100 tracking-tight flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-blue-400" /> How An Atomic Reactor Works
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            
            <div className="bg-gray-950/40 p-3.5 rounded-xl border border-gray-850">
              <h5 className="text-xs font-mono font-bold text-blue-400 mb-1 leading-tight">1. The Fuel Core</h5>
              <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                Contains Uranium-235. Incident neutrons trigger fission events, splitting atomic nuclei and releasing immense thermal energy along with additional neutrons.
              </p>
            </div>

            <div className="bg-gray-950/40 p-3.5 rounded-xl border border-gray-850">
              <h5 className="text-xs font-mono font-bold text-blue-400 mb-1 leading-tight">2. Moderators</h5>
              <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                Water or graphite layers decelerate fast-moving neutrons. Slower thermal neutrons have a significantly higher probability of inducing subsequent fission.
              </p>
            </div>

            <div className="bg-gray-950/40 p-3.5 rounded-xl border border-gray-850">
              <h5 className="text-xs font-mono font-bold text-blue-400 mb-1 leading-tight">3. Boron Control</h5>
              <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                Control rods utilize neutron-absorbing materials (Boron/Cadmium). Insertion mitigates reactivity; fully inserting rods halts the fission chain reaction (SCRAM).
              </p>
            </div>

            <div className="bg-gray-950/40 p-3.5 rounded-xl border border-gray-850">
              <h5 className="text-xs font-mono font-bold text-blue-400 mb-1 leading-tight">4. Coolant System</h5>
              <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                <strong>PWR</strong> designs utilize a primary enclosed pressure loop to transfer heat to a secondary boiler. <strong>BWR</strong> allows the coolant to boil within the core.
              </p>
            </div>

            <div className="bg-gray-950/40 p-3.5 rounded-xl border border-gray-850">
              <h5 className="text-xs font-mono font-bold text-blue-400 mb-1 leading-tight">5. Steam Turbine</h5>
              <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                High-pressure steam expands against turbine blades, driving a synchronized mechanical alternator to generate continuous grid electricity.
              </p>
            </div>

          </div>
        </section>

      </main>

      <footer className="bg-[#0b0c10] border-t border-slate-900 py-6 px-6 mt-12 text-center text-xs text-slate-500 font-mono">
        <p>© 2026 Nuclear Energy Simulation Project • Developed by Vedant Nirwan</p>
        <p className="mt-1 text-[10px] text-slate-600">Built using React, TypeScript, Vite, Tailwind CSS, & Custom Canvas Physics Engine</p>
      </footer>
    </div>
  );
}
