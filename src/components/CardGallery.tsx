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

    const groupedCards = {
        LEGENDARY: cards.filter(c => c.rarity === 'LEGENDARY'),
        EPIC: cards.filter(c => c.rarity === 'EPIC'),
        RARE: cards.filter(c => c.rarity === 'RARE'),
        COMMON: cards.filter(c => c.rarity === 'COMMON'),
    };

    const rarityOrder: (keyof typeof groupedCards)[] = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    const rarityColors = {
        LEGENDARY: 'text-[#ff8800]',
        EPIC: 'text-[#ff00ff]',
        RARE: 'text-[#00ffff]',
        COMMON: 'text-gray-400'
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-4 bg-black min-h-screen">
                <Loader2 className="animate-spin text-[#ff8800]" size={48} />
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">Caricamento Archivio...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 animate-in fade-in duration-500 relative overflow-hidden flex flex-col">
            {/* Custom Background Image */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-lighten"
                style={{
                    backgroundImage: `url('/card_bg.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}>
            </div>

            {/* Strategic Orange Glows */}
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#ff8800]/10 blur-[150px] rounded-full pointer-events-none z-0"></div>
            <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#ff8800]/5 blur-[150px] rounded-full pointer-events-none z-0"></div>

            <div className="max-w-7xl mx-auto w-full relative z-10 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div>
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 group"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Torna Indietro</span>
                        </button>
                        <h1 className="text-5xl md:text-7xl font-black italic uppercase leading-none flex items-center gap-4">
                            Archivio <span className="text-[#ff8800] drop-shadow-[0_0_20px_rgba(255,136,0,0.4)]">Card</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-6 p-5 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-xl shrink-0 border-white/10 shadow-xl">
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Collezione Totale</p>
                            <p className="text-3xl font-black italic text-[#ff8800]">
                                {unlockedCount} <span className="text-white/20">/</span> {cards.length}
                            </p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-[#ff8800]/20 flex items-center justify-center border border-[#ff8800]/30 shadow-[0_0_20px_rgba(255,136,0,0.2)]">
                            <Award className="text-[#ff8800]" size={28} />
                        </div>
                    </div>
                </div>

                {/* Grouped Content */}
                <div className="space-y-20 flex-1">
                    {cards.length === 0 ? (
                        <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.02]">
                            <p className="text-gray-500 font-black uppercase tracking-widest text-sm italic">Nessuna card ancora in archivio.</p>
                            <p className="text-[10px] text-gray-700 font-bold uppercase mt-2">L'AI sta curando i nuovi contenuti...</p>
                        </div>
                    ) : (
                        rarityOrder.map(rarity => {
                            const rarityCards = groupedCards[rarity];
                            if (rarityCards.length === 0) return null;

                            return (
                                <div key={rarity} className="space-y-8">
                                    <div className="flex items-center gap-6">
                                        <div className={`h-px flex-1 bg-gradient-to-r from-transparent via-[#ff8800]/20 to-transparent`}></div>
                                        <h2 className={`text-[10px] font-black uppercase tracking-[0.5em] ${rarityColors[rarity]} flex items-center gap-4`}>
                                            <Award size={24} className="drop-shadow-[0_0_10px_currentColor]" />
                                            {rarity}
                                        </h2>
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#ff8800]/20 to-transparent"></div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                                        {rarityCards.map(card => (
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
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Tip */}
                <div className="mt-32 mb-10 flex justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3 px-8 py-4 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                            <LayoutGrid size={14} className="text-[#ff8800]" />
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider italic">Continua a giocare per sbloccare le card leggendarie!</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
