import React, { useState } from 'react';
import { X, SprayCan, Loader2, Palette, Type } from 'lucide-react';
import {
    muralesService,
    type MuralesColor,
    type MuralesFontStyle,
    type MuralesTag
} from '../../services/muralesService';

interface CreateTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTagCreated: (tag: MuralesTag) => void;
    currentUsername?: string;
    targetPosition?: { x: number; y: number } | null;
}

const COLORS: { id: MuralesColor; label: string; bgClass: string; hex: string }[] = [
    { id: 'neon-cyan', label: 'Ciano Neon', bgClass: 'bg-[#00f3ff]', hex: '#00f3ff' },
    { id: 'acid-green', label: 'Verde Acido', bgClass: 'bg-[#bfff00]', hex: '#bfff00' },
    { id: 'hot-pink', label: 'Fucsia Street', bgClass: 'bg-[#ff007f]', hex: '#ff007f' },
    { id: 'electric-purple', label: 'Viola Elettrico', bgClass: 'bg-[#c084fc]', hex: '#c084fc' },
    { id: 'sun-orange', label: 'Arancio Tramonto', bgClass: 'bg-[#ff7700]', hex: '#ff7700' },
    { id: 'pure-white', label: 'Gesso Bianco', bgClass: 'bg-white', hex: '#ffffff' },
];

const STYLES: { id: MuralesFontStyle; label: string; desc: string }[] = [
    { id: 'spray', label: 'Graffiti Spray', desc: 'Tratto spray artistico' },
    { id: 'marker', label: 'Pennarello Fat', desc: 'Marker street spesso' },
    { id: 'stencil', label: 'Cyber Stencil', desc: 'Caratteri militari neon' },
    { id: 'neon', label: 'Insegna Neon', desc: 'Bagliore cyber futuristico' },
    { id: 'drip', label: 'Vernice Colata', desc: 'Street italic fluido' },
];

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
    isOpen,
    onClose,
    onTagCreated,
    currentUsername,
    targetPosition
}) => {
    const [message, setMessage] = useState('');
    const [color, setColor] = useState<MuralesColor>('neon-cyan');
    const [fontStyle, setFontStyle] = useState<MuralesFontStyle>('spray');
    const [scale, setScale] = useState<number>(1.2); // Default più grande
    const [rotation, setRotation] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        try {
            setSubmitting(true);
            setError(null);

            const result = await muralesService.createTag({
                message: message.trim(),
                color,
                font_style: fontStyle,
                rotation,
                pos_x: targetPosition?.x,
                pos_y: targetPosition?.y,
                scale,
            });

            if (result.success && result.tag) {
                onTagCreated(result.tag);
                setMessage('');
                onClose();
            } else {
                setError(result.error || 'Impossibile spruzzare la scritta sul muro.');
            }
        } catch (err: any) {
            setError(err?.message || 'Errore durante l\'inserimento.');
        } finally {
            setSubmitting(false);
        }
    };

    const getPreviewClass = () => {
        const colorClass = `tag-${color}`;
        const fontClass = `font-graffiti-${fontStyle}`;
        return `${colorClass} ${fontClass}`;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
            <div
                className="absolute inset-0 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative z-10 w-full max-w-lg bg-[#0a0c10] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-[#ff8800]/20 rounded-xl border border-[#ff8800]/40">
                            <SprayCan size={20} className="text-[#ff8800] animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black italic uppercase text-white tracking-tight">
                                Tagga il Murales
                            </h3>
                            <p className="text-[10px] font-mono text-gray-400">
                                Firma anonima o come <span className="text-[#00f3ff] font-bold">@{currentUsername || 'Tu'}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Input Frase */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                                La tua Frase / Tag
                            </label>
                            <span className={`text-[10px] font-mono ${message.length > 120 ? 'text-rose-400' : 'text-gray-500'}`}>
                                {message.length}/140
                            </span>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={140}
                            rows={3}
                            placeholder="Scrivi qualcosa sul muro... sfottò, massime, profezie o un tuo marchio!"
                            className="w-full bg-[#11141c] border border-white/10 rounded-2xl p-3.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#00f3ff]/60 focus:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all resize-none"
                            autoFocus
                        />
                    </div>

                    {/* Anteprima Live sul Cemento */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 block">
                            Anteprima sul Muro
                        </label>
                        <div className="min-h-28 rounded-2xl murales-wall-bg border border-white/10 flex items-center justify-center p-4 relative overflow-hidden shadow-inner">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                            <p
                                className={`text-center transition-all duration-200 select-none whitespace-pre-wrap leading-tight break-words max-w-full ${getPreviewClass()}`}
                                style={{
                                    transform: `rotate(${rotation}deg) scale(${scale})`,
                                    fontSize: `${1.25 * scale}rem`
                                }}
                            >
                                {message || 'IL TUO GRAFFITO'}
                            </p>
                        </div>
                    </div>

                    {/* Scelta Bomboletta (Colore) */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <Palette size={14} className="text-[#00f3ff]" />
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                                Colore Bomboletta
                            </label>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {COLORS.map((c) => (
                                <button
                                    type="button"
                                    key={c.id}
                                    onClick={() => setColor(c.id)}
                                    className={`h-11 rounded-xl flex items-center justify-center transition-all ${
                                        color === c.id
                                            ? 'ring-2 ring-white scale-105 shadow-lg'
                                            : 'opacity-70 hover:opacity-100 hover:scale-100'
                                    } ${c.bgClass}`}
                                    title={c.label}
                                >
                                    {color === c.id && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-black/70" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scelta Stile Tratto */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <Type size={14} className="text-[#bfff00]" />
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                                Stile del Tag
                            </label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {STYLES.map((s) => (
                                <button
                                    type="button"
                                    key={s.id}
                                    onClick={() => setFontStyle(s.id)}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        fontStyle === s.id
                                            ? 'bg-white/10 border-[#bfff00] text-white shadow-[0_0_15px_rgba(191,255,0,0.2)]'
                                            : 'bg-white/[0.02] border-white/5 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <div className="text-[11px] font-black uppercase tracking-wider text-white">
                                        {s.label}
                                    </div>
                                    <div className="text-[8px] text-gray-500 font-mono">
                                        {s.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Regolazione Dimensione Scritta (Scala) */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                                Grandezza Tag (Scala)
                            </label>
                            <span className="text-[10px] font-mono text-[#bfff00] font-bold">
                                {scale <= 0.9 ? 'Compatta' : scale <= 1.2 ? 'Media' : scale <= 1.5 ? 'Grande' : 'Maxi Bomba'} ({scale}x)
                            </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { val: 0.9, label: 'Small' },
                                { val: 1.2, label: 'Medium' },
                                { val: 1.5, label: 'Large' },
                                { val: 1.8, label: 'XL Maxi' }
                            ].map((s) => (
                                <button
                                    type="button"
                                    key={s.val}
                                    onClick={() => setScale(s.val)}
                                    className={`py-2 px-1 rounded-xl text-xs font-black uppercase transition-all ${
                                        scale === s.val
                                            ? 'bg-[#bfff00] text-black shadow-[0_0_15px_rgba(191,255,0,0.4)] scale-105'
                                            : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Regolazione Angolazione / Inclinazione */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                Inclinazione a Mano Libera
                            </label>
                            <span className="text-[10px] font-mono text-gray-400">{rotation}°</span>
                        </div>
                        <input
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={rotation}
                            onChange={(e) => setRotation(Number(e.target.value))}
                            className="w-full accent-[#00f3ff] cursor-pointer"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                            {error}
                        </div>
                    )}

                    {/* Pulsante Invio */}
                    <button
                        type="submit"
                        disabled={submitting || !message.trim()}
                        className="mt-2 py-4 px-6 bg-gradient-to-r from-[#ff8800] via-[#ffaa00] to-[#ff6600] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-black font-black uppercase text-sm tracking-[0.2em] rounded-2xl shadow-[0_0_25px_rgba(255,136,0,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Spruzzando la vernice...</span>
                            </>
                        ) : (
                            <>
                                <SprayCan size={18} />
                                <span>Spruzza sul Muro</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
