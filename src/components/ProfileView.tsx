import React, { useState, useRef } from 'react';
import type { User } from '../types';
import { gameService } from '../services/gameService';
import { Camera, Edit2, Check, X, Trophy, Skull, Activity, Target } from 'lucide-react';

interface ProfileViewProps {
    user: User | null;
    onClose: () => void;
    onLogout?: () => void;
    onProfileUpdate?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onClose, onLogout, onProfileUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState(user?.username || '');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showInstallInfo, setShowInstallInfo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpdateProfile = async () => {
        if (!newUsername.trim()) return;
        setLoading(true);
        const res = await gameService.updateProfile(newUsername);
        if (res.success) {
            setIsEditing(false);
            if (onProfileUpdate) onProfileUpdate();
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const res = await gameService.uploadAvatar(file);
        if (res.success && res.url) {
            const updateRes = await gameService.updateProfile(user?.username || '', res.url);
            if (updateRes.success) {
                if (onProfileUpdate) onProfileUpdate();
            }
        } else {
            alert(res.message);
        }
        setUploading(false);
    };

    // --- LEVEL SYSTEM LOGIC ---
    const milestones = [
        { level: 1, label: 'Principiante', requirements: { bets: 0, wins: 0, tokens: 0 } },
        { level: 2, label: 'Scommettitore', requirements: { bets: 5, wins: 1, tokens: 100 } },
        { level: 3, label: 'Veterano', requirements: { bets: 15, wins: 3, tokens: 500 } },
        { level: 4, label: 'Campione', requirements: { bets: 30, wins: 7, tokens: 1500 } },
        { level: 5, label: 'Leggenda', requirements: { bets: 50, wins: 15, tokens: 5000 } },
    ];

    const currentLevel = user?.level || 1;
    const nextMilestone = milestones.find(m => m.level === currentLevel + 1);

    // Calculate progress percentage for the next level based on the most advanced requirement
    const calculateProgress = () => {
        if (!nextMilestone) return 100;
        const reqs = nextMilestone.requirements;
        const betsProg = Math.min(100, ((user?.betsPlaced || 0) / reqs.bets) * 100);
        const winsProg = Math.min(100, (((user?.wins1x2 || 0) + (user?.winsSurvival || 0)) / reqs.wins) * 100);
        const tokensProg = Math.min(100, ((user?.totalTokensWon || 0) / reqs.tokens) * 100);
        return Math.max(betsProg, winsProg, tokensProg);
    };

    const stats = [
        {
            label: 'Vittorie 1X2',
            value: user?.wins1x2 || 0,
            icon: <Trophy className="text-black" size={18} />,
            color: 'bg-gradient-to-br from-brand-gold to-yellow-600 shadow-brand-gold/20'
        },
        {
            label: 'Survival',
            value: user?.winsSurvival || 0,
            icon: <Skull className="text-white" size={18} />,
            color: 'bg-gradient-to-br from-red-600 to-red-900 shadow-red-600/20'
        },
        {
            label: 'Livello',
            value: currentLevel,
            icon: <Activity className="text-black" size={18} />,
            color: 'bg-gradient-to-br from-brand-purple to-purple-900 shadow-brand-purple/20'
        },
        {
            label: 'Precisione',
            value: `${user?.predictionAccuracy || 0}%`,
            icon: <Target className="text-black" size={18} />,
            color: 'bg-gradient-to-br from-brand-teal to-teal-800 shadow-brand-teal/20'
        },
    ];

    return (
        <div className="relative animate-fade-in px-4 max-w-4xl mx-auto pt-4 pb-20 min-h-screen">
            {/* Deep Blue Gradient Background */}
            <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#020617]">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/5 via-blue-900/10 to-[#020617]"></div>
                {/* Mesh Glows */}
                <div className="absolute -top-48 -left-48 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow"></div>
                <div className="absolute top-1/2 -right-48 w-[500px] h-[500px] bg-brand-purple/5 blur-[150px] rounded-full animate-float"></div>
                <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full"></div>
            </div>

            {/* Header / Avatar Section */}
            <div className="flex flex-col items-center mb-10">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-brand-purple shadow-[0_0_40px_rgba(157,0,255,0.3)] bg-black/40 flex items-center justify-center">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl md:text-6xl text-brand-purple opacity-40">👤</span>
                        )}
                        {uploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            </div>
                        )}
                        {!uploading && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                                <Camera className="text-white" size={28} />
                            </div>
                        )}
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

                <div className="mt-4 flex flex-col items-center text-center px-4">
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="bg-black/60 border-2 border-brand-purple rounded-lg px-3 py-1 text-lg md:text-xl font-black italic tracking-tighter text-white outline-none w-full max-w-[200px]"
                                autoFocus
                            />
                            <button onClick={handleUpdateProfile} disabled={loading} className="p-2 bg-green-500 rounded-lg text-black">
                                <Check size={18} />
                            </button>
                            <button onClick={() => { setIsEditing(false); setNewUsername(user?.username || ''); }} className="p-2 bg-red-500 rounded-lg text-black">
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl md:text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(157,0,255,0.3)] uppercase">
                                {user?.username}
                            </h1>
                            <button onClick={() => setIsEditing(true)} className="p-1.5 text-gray-500 hover:text-white transition-colors">
                                <Edit2 size={16} />
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                        <span className="px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/40 text-[10px] font-black text-brand-purple uppercase tracking-[0.2em]">
                            {milestones[currentLevel - 1]?.label || 'Novizio'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">ID: {user?.id?.slice(0, 8)}</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Reduced Size & More Color */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
                {stats.map((stat, idx) => (
                    <div key={idx} className={`${stat.color} p-4 md:p-5 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg transform hover:scale-[1.02] transition-all cursor-default relative overflow-hidden group`}>
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="mb-2 p-2 rounded-xl bg-white/20 backdrop-blur-sm shadow-inner group-hover:rotate-12 transition-transform">
                            {stat.icon}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-black/60 mb-0.5">{stat.label}</span>
                        <span className="text-xl md:text-2xl font-mono font-black text-white drop-shadow-sm">{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Detailed Level Progress */}
            <div className="glass-card border-white/5 bg-black/40 !p-6 md:!p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Activity size={120} className="text-brand-purple" />
                </div>

                <h3 className="text-lg font-black italic uppercase tracking-widest text-white mb-6">PROGRESSO STAGIONALE</h3>

                <div className="space-y-12 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 md:gap-0">
                        {/* Current Level Badge */}
                        <div className="flex flex-col items-center md:items-start group transition-all duration-500">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1 px-2 rounded bg-brand-purple/20 border border-brand-purple/40">
                                    <span className="text-[8px] font-black text-brand-purple uppercase tracking-[0.2em] animate-pulse">Status Attuale</span>
                                </div>
                            </div>
                            <div className="relative">
                                <h4 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-brand-purple via-purple-400 to-indigo-400 uppercase drop-shadow-[0_10px_20px_rgba(157,0,255,0.4)]">
                                    {milestones[currentLevel - 1]?.label}
                                </h4>
                                <div className="absolute -bottom-2 md:-bottom-4 left-0 w-full h-1.5 bg-brand-purple/30 rounded-full blur-[2px]"></div>
                                <div className="absolute -bottom-2 md:-bottom-4 left-0 w-1/3 h-1.5 bg-brand-purple rounded-full shadow-[0_0_15px_brand-purple]"></div>
                            </div>
                        </div>

                        {/* Connection Line & Icon */}
                        <div className="hidden md:flex flex-col items-center justify-center opacity-30 px-6">
                            <div className="p-2 rounded-full border border-white/10 bg-white/5 animate-float">
                                <Target size={24} className="text-brand-teal" />
                            </div>
                            <div className="h-px w-32 bg-gradient-to-r from-brand-purple via-brand-teal to-brand-diamond mt-4 shadow-[0_0_10px_rgba(185,242,255,0.3)]"></div>
                        </div>

                        {/* Next Level Badge */}
                        <div className="flex flex-col items-center md:items-end group transition-all duration-500 opacity-60 hover:opacity-100">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">Destinazione</span>
                                <div className="p-1 px-2 rounded bg-white/5 border border-white/10">
                                    <Trophy size={10} className="text-gray-400" />
                                </div>
                            </div>
                            <div className="text-center md:text-right">
                                <h4 className="text-2xl md:text-4xl font-black italic tracking-tighter text-white uppercase tracking-tight group-hover:text-brand-diamond transition-colors">
                                    {nextMilestone?.label || 'MASSIMO'}
                                </h4>
                            </div>
                        </div>
                    </div>

                    {/* Modern Progress Bar */}
                    <div className="relative">
                        <div className="flex justify-between items-center mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-ping"></span>
                                <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] uppercase">Efficienza Sincronizzata</span>
                            </div>
                            <span className="text-xs font-black italic text-brand-teal tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]">
                                {calculateProgress().toFixed(0)}% DEL PERCORSO COMPLETATO
                            </span>
                        </div>
                        <div className="h-5 w-full bg-white/[0.03] rounded-2xl overflow-hidden border border-white/10 p-1.5 backdrop-blur-md shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-brand-purple via-brand-teal to-brand-diamond rounded-xl shadow-[0_0_30px_rgba(157,0,255,0.6)] relative overflow-hidden group/bar"
                                style={{ width: `${calculateProgress()}%`, transition: 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_100%] animate-shimmer"></div>
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                            </div>
                        </div>
                    </div>

                    {nextMilestone && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Bet Necessarie</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-white">{user?.betsPlaced || 0} / {nextMilestone.requirements.bets}</span>
                                    <span className="text-[9px] text-gray-600 font-mono">{((user?.betsPlaced || 0) / nextMilestone.requirements.bets * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Vittorie Target</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-white">{(user?.wins1x2 || 0) + (user?.winsSurvival || 0)} / {nextMilestone.requirements.wins}</span>
                                    <span className="text-[9px] text-gray-600 font-mono">{(((user?.wins1x2 || 0) + (user?.winsSurvival || 0)) / nextMilestone.requirements.wins * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Token Vinti</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-white">{user?.totalTokensWon || 0} / {nextMilestone.requirements.tokens}</span>
                                    <span className="text-[9px] text-gray-600 font-mono">{((user?.totalTokensWon || 0) / nextMilestone.requirements.tokens * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons: Install & Logout */}
            <div className="mt-12 space-y-4 max-w-sm mx-auto">
                <button
                    onClick={() => setShowInstallInfo(!showInstallInfo)}
                    className="w-full py-4 rounded-2xl bg-brand-teal/10 border border-brand-teal/30 text-brand-teal font-black uppercase tracking-[0.2em] text-xs hover:bg-brand-teal/20 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,255,204,0.1)]"
                >
                    <Activity size={18} /> {showInstallInfo ? 'Chiudi Istruzioni' : 'Installa sul Dispositivo'}
                </button>

                {showInstallInfo && (
                    <div className="glass-card !p-6 border-brand-teal/20 bg-brand-teal/5 animate-fade-in text-left">
                        <h4 className="text-brand-teal font-black italic mb-3 uppercase tracking-tighter">Come installare FANNYBET:</h4>
                        <div className="space-y-4 text-xs text-gray-400">
                            <div className="flex gap-3">
                                <span className="text-brand-teal font-black">iPhone (Safari):</span>
                                <span>Tocca l'icona <span className="text-white">Condividi</span> (quadrato con freccia) e seleziona <span className="text-white">"Aggiungi alla schermata Home"</span>.</span>
                            </div>
                            <div className="flex gap-3 border-t border-white/5 pt-4">
                                <span className="text-brand-teal font-black">Android (Chrome):</span>
                                <span>Tocca i <span className="text-white">3 puntini</span> in alto a destra e seleziona <span className="text-white">"Installa app"</span> o <span className="text-white">"Aggiungi a schermata Home"</span>.</span>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => {
                        if (window.confirm('Vuoi davvero uscire?')) {
                            if (onLogout) onLogout();
                        }
                    }}
                    className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 font-black uppercase tracking-[0.2em] text-xs hover:bg-red-500/20 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                >
                    <X size={18} /> Logout Sessione
                </button>
            </div>

            {/* Back Button */}
            <div className="mt-10 flex justify-center">
                <button
                    onClick={onClose}
                    className="px-12 py-3 rounded-full text-gray-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.4em]"
                >
                    Chiudi Profilo
                </button>
            </div>
        </div>
    );
};
