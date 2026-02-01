import React from 'react';

interface RegulationsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RegulationsModal: React.FC<RegulationsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur">
            <div className="glass-card !p-6 md:!p-10 max-h-[80vh] overflow-y-auto w-full md:max-w-2xl relative border-white/10">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 md:top-6 right-4 md:right-6 w-10 h-10 flex items-center justify-center text-2xl text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>

                <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-white mb-6" style={{ fontFamily: "'Tourney', display" }}>
                    📋 REGOLAMENTI
                </h1>

                <div className="space-y-6 text-gray-300 text-sm md:text-base leading-relaxed">

                    <section className="border-l-4 border-acid-glow pl-4 py-1">
                        <h2 className="text-lg md:text-xl font-black italic text-acid-glow mb-2 uppercase tracking-tighter">
                            1. 1x2 MODE
                        </h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                            Scommetti sull'esito delle partite selezionate per la giornata.
                            Indovinare almeno <span className="text-white">7 risultati su 10</span> ti permette di vincere il <span className="text-brand-gold">MONTE PREMI</span>.
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500 text-[10px] md:text-xs">
                            <li><span className="text-white font-bold">1</span>: Vittoria Casa | <span className="text-white font-bold">X</span>: Pareggio | <span className="text-white font-bold">2</span>: Vittoria Trasferta</li>
                            <li>Costo partecipazione: variabile in base alla giornata.</li>
                            <li>Punti Classifica: 1 punto per ogni pronostico corretto.</li>
                        </ul>
                    </section>

                    <section className="border-l-4 border-red-500 pl-4 py-1">
                        <h2 className="text-lg md:text-xl font-black italic text-red-500 mb-2 uppercase tracking-tighter">
                            2. SURVIVAL MODE
                        </h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                            Scegli una squadra per ogni turno. Se vince, sopravvivi. Se perde o pareggia, sei <span className="text-red-500">FUORI</span>.
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500 text-[10px] md:text-xs">
                            <li>Non puoi scegliere la stessa squadra più di una volta per stagione.</li>
                            <li>L'ultimo sopravvissuto vince l'intero bottino accumulato.</li>
                            <li>Bonus: Ogni eliminato aggiunge 2 FTK al premio finale.</li>
                        </ul>
                    </section>

                    <section className="border-l-4 border-brand-purple pl-4 py-1">
                        <h2 className="text-lg md:text-xl font-black italic text-brand-purple mb-2 uppercase tracking-tighter">
                            3. ARENA DELLE SFIDE
                        </h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                            Sfida un altro utente in un duello testa a testa 1vs1 sui pronostici della giornata.
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500 text-[10px] md:text-xs">
                            <li>Chi indovina più risultati vince la sfida.</li>
                            <li>In caso di pareggio, i punti vengono restituiti (meno commissione arena).</li>
                        </ul>
                    </section>

                    <section className="border-l-4 border-brand-gold pl-4 py-1">
                        <h2 className="text-lg md:text-xl font-black italic text-brand-gold mb-2 uppercase tracking-tighter">
                            4. SUPER JACKPOT
                        </h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                            Il premio supremo riservato alla perfezione assoluta.
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500 text-[10px] md:text-xs">
                            <li>Vinto da chi indovina <span className="text-brand-gold font-black">10 risultati su 10</span> nella modalità 1x2.</li>
                            <li>Il montepremi è progressivo e cresce a ogni giornata senza vincitori.</li>
                        </ul>
                    </section>

                    <section className="border-l-4 border-brand-teal pl-4 py-1">
                        <h2 className="text-lg md:text-xl font-black italic text-brand-teal mb-2 uppercase tracking-tighter">
                            5. COMUNICAZIONI WHATSAPP
                        </h2>
                        <p className="text-gray-400 text-xs md:text-sm">
                            Tutti gli utenti registrati saranno inseriti in un <span className="text-brand-teal font-bold">gruppo di notifica ufficiale WhatsApp</span>.
                        </p>
                        <p className="mt-2 text-gray-500 text-[10px] md:text-xs italic">
                            Riceverai aggiornamenti sulle scadenze, risultati in tempo reale e annunci amministrativi.
                        </p>
                    </section>

                    <section className="border-l-4 border-gray-500 pl-4 py-1">
                        <h2 className="text-lg md:text-xl font-black italic text-gray-300 mb-2 uppercase tracking-tighter">
                            6. CONDOTTA ANTISPORTIVA
                        </h2>
                        <p className="text-gray-500 text-[10px] md:text-xs">
                            Mantenere un comportamento corretto è fondamentale per la permanenza nella piattaforma.
                        </p>
                        <ul className="list-disc list-inside mt-1 space-y-1 text-gray-600 text-[9px] md:text-xs">
                            <li>Vietato il multi-accounting o l'uso di script/bot.</li>
                            <li>Qualsiasi tentativo di manipolazione dei risultati porterà al <span className="text-red-500 font-black">BAN PERMANENTE</span>.</li>
                            <li>Le decisioni degli Admin sono insindacabili.</li>
                        </ul>
                    </section>

                    <section className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 mt-8">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest text-center">
                            Ultimo aggiornamento: 30 Gennaio 2026 • Versione 2.0
                        </p>
                    </section>

                </div>

                <button
                    onClick={onClose}
                    className="mt-8 w-full py-3 px-4 bg-gradient-to-r from-brand-diamond/50 to-brand-diamond/30 hover:from-brand-diamond/70 hover:to-brand-diamond/50 text-brand-diamond font-black italic uppercase tracking-[0.2em] rounded transition-all duration-300"
                >
                    Ho capito
                </button>
            </div>
        </div>
    );
};
