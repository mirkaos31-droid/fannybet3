import React, { useState } from 'react';

interface RequestTokensModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTokens: number;
}

export const RequestTokensModal: React.FC<RequestTokensModalProps> = ({ isOpen, onClose, currentTokens }) => {
    const [amount, setAmount] = useState<string>('100');
    const [reason, setReason] = useState<string>('');
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (amount && reason) {
            // Simulare invio della richiesta
            setSubmitted(true);
            setTimeout(() => {
                setSubmitted(false);
                setAmount('100');
                setReason('');
                onClose();
            }, 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur">
            <div className="glass-card !p-6 md:!p-10 w-full md:max-w-md relative border-white/10">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 md:top-6 right-4 md:right-6 w-10 h-10 flex items-center justify-center text-2xl text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>

                {submitted ? (
                    <div className="text-center py-8">
                        <div className="text-5xl mb-4 animate-pulse">✓</div>
                        <h2 className="text-xl md:text-2xl font-black italic text-white mb-2" style={{fontFamily: "'Tourney', display"}}>
                            RICHIESTA INVIATA!
                        </h2>
                        <p className="text-gray-400 text-sm">
                            La tua richiesta di {amount} token è stata inviata all'amministrazione. Riceverai una risposta al più presto.
                        </p>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white mb-6" style={{fontFamily: "'Tourney', display"}}>
                            💎 RICHIEDI TOKEN
                        </h1>

                        <div className="space-y-5">
                            {/* Current tokens info */}
                            <div className="bg-white/5 p-4 rounded border border-white/10">
                                <p className="text-xs text-gray-400 uppercase tracking-[0.2em] font-mono mb-2">Token Attuali</p>
                                <p className="text-2xl font-black text-brand-diamond" style={{fontFamily: "'Tourney', display"}}>
                                    {currentTokens} FTK
                                </p>
                            </div>

                            {/* Amount selection */}
                            <div>
                                <label className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-gray-300 block mb-3">
                                    Quanti token vuoi?
                                </label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded text-white font-mono placeholder-gray-500 focus:outline-none focus:border-brand-diamond/50 transition-colors"
                                    placeholder="Inserisci l'importo"
                                    min="1"
                                    max="5000"
                                />
                                <p className="text-[10px] text-gray-500 mt-2">Minimo: 1 | Massimo: 5000</p>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-gray-300 block mb-3">
                                    Motivo della richiesta
                                </label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded text-white font-mono focus:outline-none focus:border-brand-diamond/50 transition-colors"
                                >
                                    <option value="">-- Seleziona un motivo --</option>
                                    <option value="initial">Ho appena iniziato</option>
                                    <option value="depleted">Ho finito i token</option>
                                    <option value="play_more">Voglio giocare di più</option>
                                    <option value="survival">Voglio partecipare a Survival Mode</option>
                                    <option value="special_event">Per un evento speciale</option>
                                    <option value="other">Altro</option>
                                </select>
                            </div>

                            {/* Info box */}
                            <div className="bg-brand-orange/10 border border-brand-orange/30 p-4 rounded">
                                <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                                    <strong className="text-brand-orange">ℹ️ Info:</strong> L'amministrazione valuterà la tua richiesta in base al tuo utilizzo della piattaforma e alla frequenza delle richieste precedenti.
                                </p>
                            </div>

                            {/* Submit button */}
                            <button
                                onClick={handleSubmit}
                                disabled={!amount || !reason}
                                className="w-full py-3 px-4 bg-gradient-to-r from-brand-diamond/50 to-brand-diamond/30 hover:from-brand-diamond/70 hover:to-brand-diamond/50 disabled:opacity-50 disabled:cursor-not-allowed text-brand-diamond font-black italic uppercase tracking-[0.2em] rounded transition-all duration-300"
                            >
                                Invia Richiesta
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
