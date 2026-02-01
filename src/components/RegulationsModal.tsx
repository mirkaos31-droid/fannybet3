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

                <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-white mb-6" style={{fontFamily: "'Tourney', display"}}>
                    📋 REGOLAMENTI
                </h1>

                <div className="space-y-6 text-gray-300 text-sm md:text-base leading-relaxed">
                    
                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            1. MODALITÀ 1X2
                        </h2>
                        <p>
                            La modalità 1X2 consente ai giocatori di scommettere sugli esiti delle partite di calcio:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li><span className="text-white font-bold">1</span> - Vittoria della squadra in casa</li>
                            <li><span className="text-white font-bold">X</span> - Pareggio</li>
                            <li><span className="text-white font-bold">2</span> - Vittoria della squadra in trasferta</li>
                        </ul>
                        <p className="mt-3 text-gray-400">
                            Ogni scommessa corretta raddoppia i token investiti. Le scommesse sbagliate comportano la perdita del capitale.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            2. I FANNIES (EYE OF THE SPY)
                        </h2>
                        <p>
                            Visualizza le scommesse piazzate dagli altri giocatori. Questa funzione consente di:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li>Analizzare le strategie altrui</li>
                            <li>Confrontare le tue scelte con quelle della comunità</li>
                            <li>Identificare tendenze e pattern di scommesse</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            3. CLASSIFICA
                        </h2>
                        <p>
                            Consulta la classifica globale dei giocatori. Il ranking si basa su:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li>Numero di scommesse vinte</li>
                            <li>Profitti/perdite netti</li>
                            <li>Streak di vittorie consecutive</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            4. SURVIVAL MODE
                        </h2>
                        <p>
                            Una modalità speciale dove gli errori ti eliminano dal gioco:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li>Ogni giornata devi fare una scommessa</li>
                            <li>Sbagliare una scommessa ti elimina</li>
                            <li>Il vincitore è chi rimane vivo al termine della stagione</li>
                            <li>Premi speciali per i sopravvissuti</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            5. SISTEMA DI JACKPOT
                        </h2>
                        <p>
                            Una parte dei token scommessi va al jackpot progressivo:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li>Il "MONTE PREMI" accumula fondi da tutte le scommesse</li>
                            <li>Lo "SUPER JACKPOT" è il premio finale per chi vince tutto</li>
                            <li>Questi jackpot crescono man mano che giocano più persone</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            6. TOKEN E ECONOMIA
                        </h2>
                        <p>
                            I token sono la valuta virtuale della piattaforma:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li>Ricevi token iniziali quando ti registri</li>
                            <li>Puoi richiedere token aggiuntivi tramite il menu in basso</li>
                            <li>Vinci token facendo scommesse corrette</li>
                            <li>Perdi token facendo scommesse sbagliate</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg md:text-xl font-black italic text-white mb-3" style={{fontFamily: "'Tourney', display"}}>
                            7. CONDOTTA SPORTIVA
                        </h2>
                        <p className="text-gray-400">
                            Comportamenti vietati:
                        </p>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                            <li>Multi-accounting (avere più account)</li>
                            <li>Truffe o raggiri nei confronti di altri giocatori</li>
                            <li>Spam o molestie in chat</li>
                            <li>Utilizzo di exploit o bug del sistema</li>
                        </ul>
                        <p className="mt-3 text-red-400 font-bold">
                            Violazioni comporteranno la sospensione o il ban permanente.
                        </p>
                    </section>

                    <section className="bg-white/5 p-4 rounded border border-white/10">
                        <p className="text-xs text-gray-400">
                            <strong>Ultimo aggiornamento:</strong> Gennaio 2026<br/>
                            <strong>Versione:</strong> 1.0<br/>
                            L'amministrazione si riserva il diritto di modificare questi regolamenti in qualsiasi momento.
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
