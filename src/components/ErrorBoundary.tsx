import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      
      return (
        <div className="p-8 border-2 border-dashed border-red-500/20 bg-red-500/5 rounded-3xl text-center animate-fade-in group hover:border-red-500/40 transition-all duration-500">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-display font-black text-white uppercase italic tracking-tighter mb-2">
            INTELLIGENCE_SYSTEM_CRASH
          </h2>
          <p className="text-gray-400 text-xs font-mono mb-6 uppercase tracking-widest leading-relaxed">
            Un errore critico ha interrotto il caricamento dei dati.<br/>
            Segnala questo codice al supporto tecnico.
          </p>
          <div className="bg-black/60 p-4 rounded-xl text-left border border-white/5 mb-6 overflow-hidden">
            <div className="text-[10px] font-mono text-red-400/70 uppercase mb-2">Error Log:</div>
            <div className="text-[10px] font-mono text-gray-500 truncate lowercase">
              {this.state.error?.message || "Unknown Runtime Error"}
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all"
          >
            Reconnect System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
