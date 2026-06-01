import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Star, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { gameService } from '../services/gameService';
import type { User } from '../types';

interface WorldCupViewProps {
    onBack: () => void;
    user: User | null;
}

export const WorldCupView: React.FC<WorldCupViewProps> = ({ onBack, user }) => {
    const [activeTab, setActiveTab] = useState<'GIRONI' | 'SCHEDINA' | 'ADMIN'>('GIRONI');
    const [loading, setLoading] = useState(true);

    const [matches, setMatches] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [clashes, setClashes] = useState<any[]>([]);
    
    // UI States
    const [myPicks, setMyPicks] = useState<Record<number, string>>({});
    const [myJolly, setMyJolly] = useState<Record<number, number>>({});
    const [realResults, setRealResults] = useState<Record<number, string>>({});
    const [currentMatchday, setCurrentMatchday] = useState(1);

    const loadData = async () => {
        setLoading(true);
        const m = await gameService.getMatches();
        const g = await gameService.getUserGroups();
        const c = await gameService.getClashes();
        
        setMatches(m);
        setGroups(g);
        setClashes(c);

        if (user) {
            const preds = await gameService.getUserPredictions(user.id);
            
            // Map predictions to state
            const picksObj: Record<number, string> = {};
            const jollyObj: Record<number, number> = {};
            preds.forEach(p => {
                picksObj[p.match_id] = p.prediction;
                if (p.is_jolly) {
                    const match = m.find(x => x.id === p.match_id);
                    if (match) jollyObj[match.matchday] = p.match_id;
                }
            });
            setMyPicks(picksObj);
            setMyJolly(jollyObj);
        }

        // Map real results
        const resObj: Record<number, string> = {};
        m.forEach(match => {
            if (match.real_result) resObj[match.id] = match.real_result;
        });
        setRealResults(resObj);

        // Calculate current matchday
        const unresolved = c.find(x => !x.is_resolved);
        setCurrentMatchday(unresolved ? unresolved.matchday : (c.length > 0 ? 6 : 1));

        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [user]);

    const handleJoin = async () => {
        if (!user) return;
        const res = await gameService.joinWorldCup(user.id);
        if (res.success) {
            toast.success("Iscritto con successo! Sei nella sala d'attesa.");
            loadData();
        } else {
            toast.error("Errore: " + res.message);
        }
    };

    const handleSavePredictions = async () => {
        if (!user) return;
        
        const predsToSave = [];
        const mdMatches = matches.filter(m => m.matchday === currentMatchday);
        
        for (const m of mdMatches) {
            if (myPicks[m.id]) {
                predsToSave.push({
                    match_id: m.id,
                    prediction: myPicks[m.id],
                    is_jolly: myJolly[currentMatchday] === m.id
                });
            }
        }

        const res = await gameService.savePredictions(user.id, predsToSave);
        if (res.success) {
            toast.success("Schedina salvata su Supabase!");
            loadData();
        } else {
            toast.error("Errore: " + res.message);
        }
    };

    // Admin Tools
    const handleInitMatches = async () => {
        const res = await gameService.adminInitializeWorldCupMatches();
        if (res.success) {
            toast.success("72 Partite Inizializzate!");
            loadData();
        }
    };

    const handleGenerateGroups = async () => {
        const res = await gameService.adminGenerateGroups();
        if (res.success) {
            toast.success("Gironi e Calendario generati!");
            loadData();
        } else {
            toast.error(res.message);
        }
    };

    const handleResolveMatchday = async () => {
        // Save real results first
        await gameService.adminSaveRealResults(realResults);
        const res = await gameService.adminResolveMatchday(currentMatchday);
        if (res.success) {
            toast.success(`Giornata ${currentMatchday} archiviata!`);
            loadData();
        } else {
            toast.error(res.message);
        }
    };

    const handleReset = async () => {
        if(confirm("ATTENZIONE! Vuoi cancellare tutti i gruppi, tutti i pronostici e svuotare il mondiale per riaprire le iscrizioni?")) {
            const res = await gameService.adminResetWorldCup();
            if (res.success) {
                toast.success("Torneo azzerato. Iscrizioni riaperte!");
                setActiveTab('GIRONI');
                loadData();
            }
        }
    };

    if (loading) {
        return <div className="text-center py-20 text-white animate-pulse">Caricamento server mondiale...</div>;
    }

    const isAdmin = user?.role === 'ADMIN';
    const amIRegistered = groups.some(g => g.user_id === user?.id);
    const areGroupsGenerated = clashes.length > 0;

    return (
        <div className="max-w-6xl mx-auto w-full px-2 space-y-6 md:space-y-10 mb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white/10 transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl md:text-3xl font-black italic uppercase text-white tracking-tight">Mondiali 2026</h2>
                            <span className="px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><Globe size={10}/> LIVE</span>
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-400 font-mono mt-1">Connesso a Supabase.</p>
                    </div>
                </div>

                {!amIRegistered && !areGroupsGenerated && (
                    <button onClick={handleJoin} className="px-6 py-3 bg-[#00f3ff] text-black font-black uppercase text-xs rounded-2xl shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:scale-105 transition-all">
                        Partecipa al Mondiale
                    </button>
                )}
            </div>

            {/* Navigation Tabs - always visible to Admin, visible to others only when groups exist */}
            {(areGroupsGenerated || isAdmin) && (
                <div className="flex bg-white/5 p-1 rounded-2xl md:rounded-full border border-white/10 overflow-x-auto no-scrollbar">
                    {areGroupsGenerated && ['GIRONI', 'SCHEDINA'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 min-w-[120px] py-3 rounded-xl md:rounded-full text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all ${
                                activeTab === tab ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-white/70 hover:bg-white/5'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('ADMIN')}
                            className={`flex-1 min-w-[120px] py-3 rounded-xl md:rounded-full text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all ${
                                activeTab === 'ADMIN' ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30' : 'text-brand-orange/50 hover:bg-white/5'
                            }`}
                        >
                            ⚙️ Admin
                        </button>
                    )}
                </div>
            )}

            {/* Content Tabs - Waiting Room */}
            {!areGroupsGenerated && (() => {
                const COLORS = [
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-cyan-400/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_14px_rgba(34,211,238,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50 shadow-[0_0_14px_rgba(217,70,239,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-lime-400/20 text-lime-300 border-lime-400/50 shadow-[0_0_14px_rgba(163,230,53,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-orange-400/20 text-orange-300 border-orange-400/50 shadow-[0_0_14px_rgba(251,146,60,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-rose-400/20 text-rose-300 border-rose-400/50 shadow-[0_0_14px_rgba(251,113,133,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-[0_0_14px_rgba(251,191,36,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-violet-500/20 text-violet-300 border-violet-500/50 shadow-[0_0_14px_rgba(139,92,246,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-teal-400/20 text-teal-300 border-teal-400/50 shadow-[0_0_14px_rgba(45,212,191,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-sky-400/20 text-sky-300 border-sky-400/50 shadow-[0_0_14px_rgba(56,189,248,0.4)] hover:scale-105',
                    'px-5 py-2.5 rounded-full text-sm font-black border bg-emerald-400/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_14px_rgba(52,211,153,0.4)] hover:scale-105',
                ];
                return (
                    <div className="py-16 px-8 bg-white/5 border border-white/10 rounded-3xl text-center">
                        <Users size={64} className="mx-auto text-white/20 mb-6" />
                        <h3 className="text-3xl font-black text-white mb-1">Sala d'Attesa</h3>
                        <p className="text-gray-400 mb-8 text-sm">Iscrizioni aperte. I gironi verranno generati dall'Admin quando tutti saranno pronti.</p>
                        {groups.length === 0 ? (
                            <p className="text-gray-600 italic text-sm">Nessun iscritto ancora. Sii il primo!</p>
                        ) : (
                            <>
                                <p className="text-gray-500 text-xs uppercase tracking-widest mb-5 font-bold">{groups.length} iscritto{groups.length !== 1 ? 'i' : ''}</p>
                                <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
                                    {groups.map((g, i) => {
                                        const isMe = g.user_id === user?.id;
                                        const profile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
                                        const displayName = g.bot_name || profile?.username || (isMe ? user?.username : 'Utente');
                                        return (
                                            <span key={i} className={`${COLORS[i % COLORS.length]} transition-all`}>
                                                {isMe ? '⭐ ' : ''}{displayName}
                                            </span>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                );
            })()}

            {areGroupsGenerated && activeTab === 'GIRONI' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Render Gironi qui. Raggruppa i partecipanti per group_name */}
                    {['A','B','C','D','E'].map(grpLetter => {
                        const grpPlayers = groups.filter(g => g.group_name === grpLetter);
                        if(grpPlayers.length === 0) return null;

                        // Calculate standings from resolved clashes
                        const standings = grpPlayers.map(p => {
                            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                            const displayName = p.bot_name || profile?.username || (p.user_id === user?.id ? user?.username : 'Utente');
                            let pts = 0, played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
                            clashes.filter(c => c.is_resolved).forEach(c => {
                                if (c.home_participant_id === p.id) {
                                    played++; gf += c.home_score; ga += c.away_score;
                                    if (c.home_score > c.away_score) { pts += 3; won++; }
                                    else if (c.home_score === c.away_score) { pts += 1; drawn++; }
                                    else lost++;
                                } else if (c.away_participant_id === p.id) {
                                    played++; gf += c.away_score; ga += c.home_score;
                                    if (c.away_score > c.home_score) { pts += 3; won++; }
                                    else if (c.away_score === c.home_score) { pts += 1; drawn++; }
                                    else lost++;
                                }
                            });
                            return { displayName, pts, played, won, drawn, lost, gf, ga, isMe: p.user_id === user?.id };
                        }).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

                        return (
                            <div key={grpLetter} className="bg-black/40 border border-white/10 rounded-3xl p-6">
                                <h3 className="text-xl font-black italic text-white mb-4">GIRONE {grpLetter}</h3>
                                {/* Header */}
                                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 text-[9px] text-gray-500 font-black uppercase tracking-widest px-3 mb-2">
                                    <span>Giocatore</span><span>G</span><span>V</span><span>P</span><span>S</span><span>Pt</span>
                                </div>
                                {standings.map((s, idx) => (
                                    <div key={idx} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-center p-3 rounded-xl mb-1 text-sm ${
                                        idx === 0 ? 'bg-brand-orange/10 border border-brand-orange/20' : 'border-b border-white/5'
                                    }`}>
                                        <span className={`font-bold truncate ${s.isMe ? 'text-brand-orange' : 'text-white'}`}>
                                            {s.isMe ? '⭐ ' : ''}{s.displayName}
                                        </span>
                                        <span className="text-gray-400 text-center">{s.played}</span>
                                        <span className="text-green-400 text-center">{s.won}</span>
                                        <span className="text-yellow-400 text-center">{s.drawn}</span>
                                        <span className="text-red-400 text-center">{s.lost}</span>
                                        <span className="text-white font-black text-center">{s.pts}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {areGroupsGenerated && activeTab === 'SCHEDINA' && (
                <div className="space-y-6">
                    {/* Filtro Giornata */}
                    <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
                        {[1,2,3,4,5,6].map(md => (
                            <button 
                                key={md} 
                                onClick={() => setCurrentMatchday(md)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold ${currentMatchday === md ? 'bg-[#00f3ff] text-black' : 'bg-white/10 text-white'}`}
                            >
                                G.{md}
                            </button>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                        {matches.filter(m => m.matchday === currentMatchday).map(m => (
                            <div key={m.id} className="bg-black/40 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                                <div className="text-white">
                                    <div className="text-xs text-gray-400">Gr. {m.group_name} • {new Date(m.match_time).toLocaleDateString()}</div>
                                    <div className="font-bold">{m.home_team} - {m.away_team}</div>
                                </div>
                                {m.is_big_match ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number" min="0" max="20"
                                            placeholder="0"
                                            value={myPicks[m.id]?.split('-')[0] || ''}
                                            onChange={(e) => {
                                                const away = myPicks[m.id]?.split('-')[1] || '0';
                                                setMyPicks({...myPicks, [m.id]: `${e.target.value}-${away}`});
                                            }}
                                            className="w-12 bg-white/10 text-center rounded-lg p-2 text-white border border-white/20 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="text-white font-black text-lg">-</span>
                                        <input
                                            type="number" min="0" max="20"
                                            placeholder="0"
                                            value={myPicks[m.id]?.split('-')[1] || ''}
                                            onChange={(e) => {
                                                const home = myPicks[m.id]?.split('-')[0] || '0';
                                                setMyPicks({...myPicks, [m.id]: `${home}-${e.target.value}`});
                                            }}
                                            className="w-12 bg-white/10 text-center rounded-lg p-2 text-white border border-white/20 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        {['1','X','2'].map(res => (
                                            <button 
                                                key={res}
                                                onClick={() => setMyPicks({...myPicks, [m.id]: res})}
                                                className={`w-10 h-10 rounded-lg font-bold ${myPicks[m.id] === res ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                                            >
                                                {res}
                                            </button>
                                        ))}
                                        <button 
                                            onClick={() => setMyJolly({...myJolly, [currentMatchday]: m.id})}
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${myJolly[currentMatchday] === m.id ? 'bg-yellow-500 text-black' : 'bg-white/10 text-yellow-500/50'}`}
                                        >
                                            <Star size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button onClick={handleSavePredictions} className="w-full py-4 bg-brand-purple text-white font-black rounded-xl">
                        SALVA SCHEDINA
                    </button>
                </div>
            )}

            {isAdmin && activeTab === 'ADMIN' && (
                <div className="space-y-6">
                    <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl">
                        <h3 className="text-red-500 font-bold mb-4">Pannello Admin</h3>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={handleInitMatches} className="px-4 py-2 bg-white/10 text-white rounded">1. Init 72 Matches</button>
                            <button onClick={handleGenerateGroups} className="px-4 py-2 bg-white/10 text-white rounded">2. Genera Gironi</button>
                            <button onClick={handleResolveMatchday} className="px-4 py-2 bg-brand-orange text-white rounded font-bold">3. Archivia Giornata {currentMatchday}</button>
                            <button onClick={handleReset} className="px-4 py-2 bg-red-600/50 text-white rounded font-bold border border-red-500 ml-auto">⚠️ RESETTA TORNEO</button>
                        </div>
                    </div>

                    {/* Admin Results Input */}
                    <h3 className="text-white font-bold">Inserimento Risultati Reali G.{currentMatchday}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {matches.filter(m => m.matchday === currentMatchday).map(m => (
                            <div key={m.id} className="bg-white/5 p-3 rounded-lg flex flex-col gap-2">
                                <span className="text-white text-xs">{m.home_team} - {m.away_team} {m.is_big_match && '(BIG)'}</span>
                                <input 
                                    type="text" 
                                    placeholder={m.is_big_match ? "es. 1-0" : "es. 1"} 
                                    value={realResults[m.id] || ''}
                                    onChange={(e) => setRealResults({...realResults, [m.id]: e.target.value.toUpperCase()})}
                                    className="bg-black/50 text-white p-2 rounded border border-white/10 text-center"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
