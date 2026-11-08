import React from 'react';
import { AlertTriangle, X, ShieldAlert, CreditCard, Clock } from 'lucide-react';

export interface SchedinaErrorDetails {
    title?: string;
    message: string;
    type?: 'warning' | 'error' | 'installment' | 'deadline' | 'incomplete';
    actionText?: string;
    onAction?: () => void;
}

interface SchedinaErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    error: SchedinaErrorDetails | null;
}

export const SchedinaErrorModal: React.FC<SchedinaErrorModalProps> = ({
    isOpen,
    onClose,
    error,
}) => {
    if (!isOpen || !error) return null;

    const getIconAndColor = () => {
        switch (error.type) {
            case 'installment':
                return {
                    icon: <CreditCard className="w-9 h-9 text-amber-400 animate-pulse" />,
                    badgeColor: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
                    boxBorder: 'border-amber-500/40',
                    glow: 'shadow-[0_0_50px_rgba(245,158,11,0.25)]',
                    accentBtn: 'bg-amber-500 hover:bg-amber-400 text-black',
                    label: 'Rata Richiesta'
                };
            case 'deadline':
                return {
                    icon: <Clock className="w-9 h-9 text-rose-400 animate-pulse" />,
                    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                    boxBorder: 'border-rose-500/40',
                    glow: 'shadow-[0_0_50px_rgba(244,63,94,0.25)]',
                    accentBtn: 'bg-rose-500 hover:bg-rose-400 text-white',
                    label: 'Tempo Scaduto'
                };
            case 'incomplete':
                return {
                    icon: <AlertTriangle className="w-9 h-9 text-yellow-400 animate-bounce" />,
                    badgeColor: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
                    boxBorder: 'border-yellow-500/40',
                    glow: 'shadow-[0_0_50px_rgba(234,179,8,0.25)]',
                    accentBtn: 'bg-yellow-500 hover:bg-yellow-400 text-black',
                    label: 'Pronostici Incompleti'
                };
            default:
                return {
                    icon: <ShieldAlert className="w-9 h-9 text-red-400 animate-pulse" />,
                    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
                    boxBorder: 'border-red-500/40',
                    glow: 'shadow-[0_0_50px_rgba(239,68,68,0.25)]',
                    accentBtn: 'bg-red-500 hover:bg-red-400 text-white',
                    label: 'Attenzione'
                };
        }
    };

    const style = getIconAndColor();

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop con blur intenso */}
            <div
                className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Dialog Card in stile Cyber */}
            <div
                className={`relative z-10 w-full max-w-md bg-[#0d0e12] border ${style.boxBorder} rounded-3xl p-6 sm:p-8 ${style.glow} animate-in zoom-in-95 duration-200 flex flex-col items-center text-center`}
                role="alertdialog"
                aria-modal="true"
            >
                {/* Pulsante chiusura in alto a destra */}
                <button
                    onClick={onClose}
                    aria-label="Chiudi avviso"
                    className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-xl transition-all text-gray-400 hover:text-white"
                >
                    <X size={18} />
                </button>

                {/* Icona circolare con glow */}
                <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-5 relative shadow-inner">
                    <div className="absolute inset-0 rounded-2xl bg-current opacity-5 blur-xl pointer-events-none" />
                    {style.icon}
                </div>

                {/* Badge tipologia */}
                <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full border mb-3 ${style.badgeColor}`}>
                    {style.label}
                </span>

                {/* Titolo Principale */}
                <h3 className="text-xl sm:text-2xl font-black italic uppercase text-white tracking-tight leading-tight mb-3">
                    {error.title || 'Impossibile Inserire la Schedina'}
                </h3>

                {/* Messaggio esplicativo dettagliato */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 w-full mb-6 text-left">
                    <p className="text-gray-300 text-xs sm:text-sm font-medium leading-relaxed break-words whitespace-pre-line text-center">
                        {error.message}
                    </p>
                </div>

                {/* Azioni */}
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    {error.onAction && error.actionText && (
                        <button
                            type="button"
                            onClick={() => {
                                error.onAction?.();
                                onClose();
                            }}
                            className={`flex-1 py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all transform active:scale-95 shadow-lg ${style.accentBtn}`}
                        >
                            {error.actionText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 px-4 bg-white/10 hover:bg-white/15 active:bg-white/25 border border-white/10 rounded-xl font-black text-xs uppercase tracking-wider text-white transition-all transform active:scale-95"
                    >
                        Ho Capito
                    </button>
                </div>
            </div>
        </div>
    );
};
