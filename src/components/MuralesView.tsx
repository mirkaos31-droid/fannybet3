import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, SprayCan, Flame, Loader2, RefreshCw, Trash2, ZoomIn, ZoomOut, Maximize2, Crown } from 'lucide-react';
import { muralesService, type MuralesTag } from '../services/muralesService';
import { CreateTagModal } from './murales/CreateTagModal';
import { supabase } from '../supabaseClient';
import type { User } from '../types';

interface MuralesViewProps {
    onBack: () => void;
    user: User | null;
}

const SIGNATURE_COLORS = [
    'text-amber-400',
    'text-cyan-400',
    'text-lime-400',
    'text-pink-400',
    'text-purple-400',
    'text-orange-400',
    'text-emerald-400',
    'text-yellow-300',
    'text-rose-400',
    'text-sky-300'
];

export const MuralesView: React.FC<MuralesViewProps> = ({ onBack, user }) => {
    const [tags, setTags] = useState<MuralesTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);

    // Zoom & Pan state
    const [zoom, setZoom] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLElement>(null);
    const touchStartDistRef = useRef<number | null>(null);
    const initialZoomRef = useRef<number>(1);

    const loadTags = async () => {
        try {
            setRefreshing(true);
            const data = await muralesService.getTags(150);
            setTags(data);
        } catch (error) {
            console.error('Error loading murales tags:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadTags();

        // Iscrizione a Supabase Realtime per nuovi tag e reazioni
        const channel = supabase
            .channel('realtime:murales')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'murales_tags' },
                (payload) => {
                    const newTag = payload.new as MuralesTag;
                    setTags((prev) => {
                        if (prev.some((t) => t.id === newTag.id)) return prev;
                        return [...prev, newTag];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'murales_tags' },
                (payload) => {
                    const updated = payload.new as MuralesTag;
                    setTags((prev) =>
                        prev.map((t) => (t.id === updated.id ? { ...t, likes_count: updated.likes_count } : t))
                    );
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'murales_tags' },
                (payload) => {
                    const deletedId = (payload.old as { id: string })?.id;
                    if (deletedId) {
                        setTags((prev) => prev.filter((t) => t.id !== deletedId));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Pinch-to-zoom con due dita su mobile
    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;

        const getDistance = (touches: TouchList) => {
            if (touches.length < 2) return null;
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                const dist = getDistance(e.touches);
                if (dist) {
                    touchStartDistRef.current = dist;
                    initialZoomRef.current = zoom;
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchStartDistRef.current) {
                const currentDist = getDistance(e.touches);
                if (currentDist) {
                    const ratio = currentDist / touchStartDistRef.current;
                    const nextZoom = Math.min(2.0, Math.max(0.6, initialZoomRef.current * ratio));
                    setZoom(Number(nextZoom.toFixed(2)));
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                touchStartDistRef.current = null;
            }
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: true });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
        };
    }, [zoom]);

    const handleReaction = async (tagId: string) => {
        setTags((prev) =>
            prev.map((t) => {
                if (t.id === tagId) {
                    const willLike = !t.user_has_liked;
                    return {
                        ...t,
                        user_has_liked: willLike,
                        likes_count: willLike ? t.likes_count + 1 : Math.max(0, t.likes_count - 1),
                    };
                }
                return t;
            })
        );

        try {
            const { liked, newCount } = await muralesService.toggleReaction(tagId);
            setTags((prev) =>
                prev.map((t) =>
                    t.id === tagId ? { ...t, user_has_liked: liked, likes_count: newCount } : t
                )
            );
        } catch (err) {
            console.error('Reaction toggle error:', err);
        }
    };

    const isAdmin = user?.role === 'ADMIN';

    const handleToggleFeatured = async (tagId: string, currentFeatured?: boolean) => {
        const nextFeatured = !currentFeatured;
        setTags((prev) =>
            prev.map((t) => ({
                ...t,
                is_featured: t.id === tagId ? nextFeatured : nextFeatured ? false : t.is_featured,
            }))
        );
        try {
            await muralesService.setFeaturedTag(tagId, nextFeatured);
        } catch (err) {
            console.error('Error toggling featured tag:', err);
        }
    };

    const handleDelete = async (tagId: string) => {
        if (!confirm('Vuoi cancellare questa scritta dal muro?')) return;
        setTags((prev) => prev.filter((t) => t.id !== tagId));
        await muralesService.deleteTag(tagId);
    };

    const handleWallClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) return;

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Coordinate percentuali esatte (0 - 100%) tenendo conto dello zoom
        const pctX = Math.round(Math.min(85, Math.max(2, (clientX / rect.width) * 100)));
        const pctY = Math.round(Math.min(92, Math.max(4, (clientY / rect.height) * 100)));

        setClickCoords({ x: pctX, y: pctY });
        setIsCreateOpen(true);
    };

    const handleZoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
    const handleZoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))));
    const handleZoomReset = () => setZoom(1);

    const getSignatureColor = (tagId: string) => {
        let hash = 0;
        for (let i = 0; i < tagId.length; i++) {
            hash = tagId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % SIGNATURE_COLORS.length;
        return SIGNATURE_COLORS[index];
    };

    return (
        <div className="fixed inset-0 z-30 murales-wall-bg text-white flex flex-col overflow-hidden select-none animate-fade-in touch-pan-x touch-pan-y pt-[calc(4.5rem+env(safe-area-inset-top,20px))] md:pt-28">
            {/* Header Superiore Esclusivo del Murales */}
            <header className="shrink-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                    {/* Pulsante Torna Indietro */}
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-2xl text-gray-300 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                        <ArrowLeft size={18} className="text-[#ff8800]" />
                        <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">
                            Torna alla Home
                        </span>
                    </button>

                    {/* Titolo Centrato */}
                    <div className="flex flex-col items-center text-center">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#ff8800] animate-ping" />
                            <h1 className="text-lg sm:text-2xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ffaa00] to-[#ff6600]">
                                Cyber Murales
                            </h1>
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-mono text-gray-400 tracking-widest uppercase">
                            Tocca il punto esatto del muro dove vuoi spruzzare la tua scritta
                        </span>
                    </div>

                    {/* Controlli Zoom & Refresh */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Zoom Out */}
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= 0.6}
                            aria-label="Riduci Zoom"
                            className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-40 cursor-pointer"
                        >
                            <ZoomOut size={16} />
                        </button>

                        {/* Reset Zoom */}
                        <button
                            onClick={handleZoomReset}
                            className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-mono text-gray-300 hover:text-white transition-all cursor-pointer"
                            title="Reset Zoom"
                        >
                            <Maximize2 size={12} />
                            <span>{Math.round(zoom * 100)}%</span>
                        </button>

                        {/* Zoom In */}
                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= 2.0}
                            aria-label="Aumenta Zoom"
                            className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-40 cursor-pointer"
                        >
                            <ZoomIn size={16} />
                        </button>

                        {/* Refresh */}
                        <button
                            onClick={loadTags}
                            disabled={refreshing}
                            aria-label="Aggiorna Muro"
                            className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer ml-1"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#ff8800]' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Canvas Libero 2D a Parete Infinito con Coordinate Reali */}
            <main
                ref={mainRef}
                className="flex-1 w-full overflow-x-auto overflow-y-auto custom-scrollbar relative"
                onClick={handleWallClick}
                title="Tocca qualsiasi punto libero del muro per piazzare la tua scritta"
            >
                <div
                    ref={containerRef}
                    style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        transition: touchStartDistRef.current ? 'none' : 'transform 0.15s ease-out',
                        width: '2600px',
                        height: '2200px',
                    }}
                    className="relative cursor-crosshair select-none"
                >
                    {/* Indicatore/Guida visiva discreta del punto toccato */}
                    {clickCoords && (
                        <div
                            className="absolute pointer-events-none -translate-y-1/2 z-20 flex items-center justify-center animate-ping"
                            style={{
                                left: `${clickCoords.x}%`,
                                top: `${clickCoords.y}%`,
                            }}
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-[#ff8800] bg-[#ff8800]/20" />
                        </div>
                    )}

                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-[#ff8800] mb-3" size={40} />
                            <span className="text-xs font-mono uppercase text-gray-500 tracking-widest">
                                Inizializzazione Parete Cemento...
                            </span>
                        </div>
                    ) : tags.length === 0 ? (
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
                                🧱
                            </div>
                            <h3 className="text-xl font-black uppercase text-white mb-2">
                                Il Muro è intonso!
                            </h3>
                            <p className="text-xs text-gray-400 max-w-sm mb-6">
                                Tocca qualsiasi punto del muro per spruzzare la prima frase con la bomboletta.
                            </p>
                        </div>
                    ) : null}

                    {/* Tutte le scritte posizionate esattamente alle coordinate scelte dall'utente */}
                    {tags.map((tag) => {
                        const isMine = user?.id && tag.user_id === user.id;
                        const colorClass = `tag-${tag.color}`;
                        const fontClass = `font-graffiti-${tag.font_style}`;
                        const tagScale = tag.scale || 1.2;
                        const signatureColor = getSignatureColor(tag.id);

                        // Se per vecchi tag manca pos_x/pos_y, calcola una posizione coerente
                        const posX = tag.pos_x !== undefined && tag.pos_x !== null ? tag.pos_x : 50;
                        const posY = tag.pos_y !== undefined && tag.pos_y !== null ? tag.pos_y : 50;

                        return (
                            <div
                                key={tag.id}
                                className="absolute group transition-transform duration-300 hover:scale-[1.04] cursor-default z-10 max-w-lg p-2"
                                style={{
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    transform: `translateY(-50%) rotate(${tag.rotation || 0}deg)`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Alone diffuso di vernice spray */}
                                <div className="absolute inset-0 rounded-full bg-current opacity-[0.04] blur-3xl pointer-events-none" />

                                {/* Scritta Graffito con grandezza scelta & a capo multilinea */}
                                <div className="select-text relative z-10">
                                    <p
                                        className={`leading-tight tracking-tight break-words whitespace-pre-wrap ${colorClass} ${fontClass}`}
                                        style={{
                                            fontSize: `${1.75 * tagScale}rem`,
                                        }}
                                    >
                                        {tag.message}
                                    </p>
                                </div>

                                {/* Firma graffiata con colore casuale & Interazioni subito sotto */}
                                <div className="mt-1 flex items-center gap-2 select-none opacity-85 group-hover:opacity-100 transition-opacity">
                                    {/* Tag firma dell'autore con colore spray dinamico */}
                                    <span className={`text-[11px] font-mono font-bold tracking-tight truncate ${signatureColor}`}>
                                        ~ {tag.username}
                                    </span>

                                    {/* Tasto Fiamma compatto */}
                                    <button
                                        onClick={() => handleReaction(tag.id)}
                                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all active:scale-90 cursor-pointer ${
                                            tag.user_has_liked
                                                ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                                : 'text-gray-400 hover:text-amber-400'
                                        }`}
                                        title="Spruzza una fiamma"
                                    >
                                        <Flame
                                            size={12}
                                            className={tag.user_has_liked ? 'text-amber-400 fill-amber-400 animate-pulse' : ''}
                                        />
                                        <span>{tag.likes_count || 0}</span>
                                    </button>

                                    {/* Corona Frase in Vetrina / Featured Tag */}
                                    {(tag.is_featured || isAdmin) && (
                                        <button
                                            onClick={() => isAdmin && handleToggleFeatured(tag.id, tag.is_featured)}
                                            disabled={!isAdmin}
                                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                                                tag.is_featured
                                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.3)] animate-pulse'
                                                    : 'text-gray-500 hover:text-amber-300 hover:bg-white/5'
                                            } ${isAdmin ? 'cursor-pointer active:scale-90' : 'cursor-default'}`}
                                            title={isAdmin ? (tag.is_featured ? 'Rimuovi dalla Vetrina Home' : 'Metti in Vetrina sulla Home') : 'Frase in Vetrina'}
                                        >
                                            <Crown size={12} className={tag.is_featured ? 'fill-amber-300 text-amber-300' : ''} />
                                            {tag.is_featured && <span className="text-[9px] uppercase tracking-wider">Vetrina</span>}
                                        </button>
                                    )}

                                    {/* Cestino per cancellare subito accanto */}
                                    {(isMine || isAdmin) && (
                                        <button
                                            onClick={() => handleDelete(tag.id)}
                                            className="p-0.5 text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                                            title="Cancella scritta"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Pulsante Flottante Fisso in Basso per Aprire la Bomboletta */}
            <div className="fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => {
                        setClickCoords({ x: 50, y: 50 });
                        setIsCreateOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#ff8800] via-[#ffaa00] to-[#ff5500] hover:brightness-110 active:scale-95 text-black font-black uppercase text-xs tracking-wider rounded-full shadow-[0_0_30px_rgba(255,136,0,0.6)] border-2 border-black transition-all cursor-pointer group"
                >
                    <SprayCan size={20} className="group-hover:rotate-12 transition-transform" />
                    <span>Tagga il Muro</span>
                </button>
            </div>

            {/* Modal Creazione Tag */}
            <CreateTagModal
                isOpen={isCreateOpen}
                onClose={() => {
                    setIsCreateOpen(false);
                    setClickCoords(null);
                }}
                onTagCreated={(newTag) => setTags((prev) => [...prev, newTag])}
                currentUsername={user?.username}
                targetPosition={clickCoords}
            />
        </div>
    );
};
