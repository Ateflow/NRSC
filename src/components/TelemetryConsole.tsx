import React from 'react';
import { SimulationState } from '../types';
import { Terminal, Activity, ShieldAlert, CheckCircle, Zap } from 'lucide-react';

interface TelemetryConsoleProps {
  state: SimulationState;
}

export default function TelemetryConsole({ state }: TelemetryConsoleProps) {
  const getLogStyle = () => {
    switch (state.reactorStatus) {
      case 'MELTDOWN':
        return { icon: <ShieldAlert className="w-5 h-5 text-red-500" />, borderColor: 'border-red-500/50', textColor: 'text-red-400' };
      case 'OVERHEATING':
        return { icon: <Activity className="w-5 h-5 text-amber-500 animate-pulse" />, borderColor: 'border-amber-500/50', textColor: 'text-amber-400' };
      case 'SCRAMMED':
        return { icon: <ShieldAlert className="w-5 h-5 text-blue-500" />, borderColor: 'border-blue-500/50', textColor: 'text-blue-400' };
      case 'OPTIMAL':
        return { icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, borderColor: 'border-emerald-500/50', textColor: 'text-emerald-400' };
      case 'STARTING':
        return { icon: <Zap className="w-5 h-5 text-cyan-500" />, borderColor: 'border-cyan-500/50', textColor: 'text-cyan-400' };
      default:
        return { icon: <Terminal className="w-5 h-5 text-gray-500" />, borderColor: 'border-gray-700', textColor: 'text-gray-400' };
    }
  };

  const style = getLogStyle();

  return (
    <div className={`bg-slate-900 border overflow-hidden rounded-xl shadow-inner ${style.borderColor}`}>
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">SYSTEM OPS LOG</span>
      </div>
      <div className="p-4 flex items-start gap-4">
        <div className="mt-0.5">
          {style.icon}
        </div>
        <div className="flex-1 font-mono text-sm leading-relaxed">
          <div className="text-xs text-slate-500 mb-1">
            [{new Date().toISOString().split('T')[1].slice(0, 8)}] [STATUS: {state.reactorStatus}]
          </div>
          <div className={style.textColor}>
            &gt; {state.activeNarration ? state.activeNarration : "Awaiting command..."}
          </div>
        </div>
      </div>
    </div>
  );
}
