import React, { useState, useEffect } from 'react';
import { cardService, type CollectibleCard as CardType } from '../services/cardService';
import { CollectibleCard } from './cards/CollectibleCard';
import { Loader2, ArrowLeft, LayoutGrid, Award } from 'lucide-react';

interface CardGalleryProps {
    onBack: () => void;
}

export const CardGallery: React.FC<CardGalleryProps> = ({ onBack }) => {
    const [cards, setCards] = useState<CardType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCards();
    }, []);

    const loadCards = async () => {
        try {
            setLoading(true);
            const data = await cardService.getAllCards();
            setCards(data);

            // If there are new cards, mark them as seen after the flip animation
            const hasNewCards = data.some(c => c.unlocked && !c.seen_in_gallery);
            if (hasNewCards) {
                setTimeout(async () => {
                    await cardService.markAllAsSeen();
                }, 3000); // 3 seconds delay after entry
            }
        } catch (error) {
            console.error('Error loading cards:', error);
        } finally {
            setLoading(false);
        }
    };

    const unlockedCount = cards.filter(c => c.unlocked).length;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="animate-spin text-[#ff8800]" size={48} />
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">Caricamento Archivio...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Torna Indietro</span>
                    </button>
                    <h1 className="text-4xl md:text-6xl font-black italic uppercase italic leading-none flex items-center gap-4">
                        Archivio <span className="text-[#ff8800]">Card</span>
                    </h1>
                </div>

                <div className="flex items-center gap-6 p-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Collezione</p>
                        <p className="text-2xl font-black italic text-[#ff8800]">
                            {unlockedCount} <span className="text-white/20">/</span> {cards.length}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-[#ff8800]/20 flex items-center justify-center border border-[#ff8800]/30 shadow-[0_0_15px_rgba(255,136,0,0.2)]">
                        <Award className="text-[#ff8800]" size={24} />
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="max-w-7xl mx-auto">
                {cards.length === 0 ? (
                    <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                        <p className="text-gray-500 font-black uppercase tracking-widest text-sm italic">Nessuna card ancora in archivio.</p>
                        <p className="text-[10px] text-gray-700 font-bold uppercase mt-2">L'AI sta curando i nuovi contenuti...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {cards.map(card => (
                            <CollectibleCard
                                key={card.id}
                                title={card.title}
                                description={card.description}
                                imageUrl={card.image_url}
                                rarity={card.rarity}
                                unlocked={card.unlocked}
                                unlockedAt={card.unlocked_at}
                                isNew={card.unlocked && !card.seen_in_gallery}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Tip */}
            <div className="max-w-7xl mx-auto mt-20 flex justify-center">
                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-full border border-white/10">
                    <LayoutGrid size={14} className="text-[#ff8800]" />
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider italic">Continua a giocare per sbloccare le card rare!</span>
                </div>
            </div>
        </div>
    );
};
