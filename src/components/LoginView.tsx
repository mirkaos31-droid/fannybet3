import React, { useState } from 'react';
import { gameService } from '../services/gameService';
import type { User } from '../types';

interface LoginViewProps {
    onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // Only for signup
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [tempUser, setTempUser] = useState<User | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                const { user, error } = await gameService.login(email, password);
                if (error) throw new Error(error);
                if (user) onLogin(user);
            } else {
                if (!username.trim()) throw new Error("Username richiesto");
                const { user, error } = await gameService.signUp(username, email, password);
                if (error) throw new Error(error);
                if (user) {
                    setTempUser(user);
                    setShowWelcome(true);
                }
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Errore sconosciuto");
        } finally {
            setLoading(false);
        }
    };

    if (showWelcome && tempUser) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-md overflow-hidden animate-fade-in">
                {/* Background Sparkles / Effects */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-orange/10 blur-[100px] animate-pulse-slow"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-purple/10 blur-[100px] animate-pulse-slow"></div>
                </div>

                <div className="relative z-10 text-center space-y-8 animate-[popIn_0.8s_ease-out_forwards]">
                    {/* Trophy/Achievement Icon */}
                    <div className="mx-auto w-24 h-24 bg-gradient-to-br from-brand-gold via-brand-orange to-brand-purple rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(255,106,0,0.5)] rotate-12 animate-float">
                        <span className="text-5xl">🏆</span>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-4xl md:text-7xl font-display font-black italic tracking-tighter leading-none text-white uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                            COMPLIMENTI!
                        </h1>
                        <div className="h-0.5 w-32 mx-auto bg-gradient-to-r from-transparent via-brand-gold to-transparent"></div>
                        <p className="text-2xl md:text-5xl font-display font-black italic tracking-tight uppercase leading-none bg-gradient-to-r from-brand-gold via-white to-brand-gold bg-[length:200%_auto] text-transparent bg-clip-text animate-[shimmerText_3s_linear_infinite]">
                            ORA SEI UN FANNIES
                        </p>
                    </div>

                    <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs md:text-sm">
                        Prepara le tue scommesse, {tempUser.username}.
                    </p>

                    <button
                        onClick={() => onLogin(tempUser)}
                        className="btn-primary !px-16 !text-2xl !py-6 !rounded-[2rem] shadow-[0_0_40px_rgba(255,106,0,0.3)] hover:shadow-[0_0_60px_rgba(255,106,0,0.5)] transition-all hover:scale-105"
                    >
                        ENTRA NELL'ARENA
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="glass-panel w-full max-w-md p-8 text-center relative overflow-hidden group border border-white/10">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-orange to-brand-purple"></div>

                <h2 className="text-3xl font-display font-bold mb-2 text-white">
                    {isLogin ? 'BENTORNATO' : 'CREA ACCOUNT'}
                </h2>
                <p className="text-gray-400 text-sm mb-8">
                    {isLogin ? 'Inserisci le credenziali per entrare.' : 'Registrati per iniziare a giocare.'}
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-4 text-sm font-bold">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    {!isLogin && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Username</label>
                            <input
                                type="text"
                                placeholder="Il tuo nome in campo..."
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-brand-orange transition-colors"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email</label>
                        <input
                            type="email"
                            placeholder="tu@esempio.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-brand-orange transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
                        <input
                            type="password"
                            placeholder="******"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-700 focus:outline-none focus:border-brand-orange transition-colors"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary py-4 mt-6 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'CARICAMENTO...' : (isLogin ? 'ENTRA IN CAMPO' : 'ISCRIVITI ORA')}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/5">
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        className="text-sm text-gray-400 hover:text-white transition-colors underline"
                    >
                        {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
                    </button>
                </div>
            </div>
        </div>
    );
};
