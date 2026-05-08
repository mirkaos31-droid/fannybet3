import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trophy, AlertTriangle, Skull, Zap, Star, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import type { User } from '../types';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'matchday' | 'survival' | 'system';
    is_read: boolean;
    created_at: string;
}

interface NotificationDrawerProps {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ user, isOpen, onClose }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!error && data) {
            setNotifications(data as Notification[]);
        }
        setLoading(false);
    }, [user]);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) {
            // Revert on error
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
        }
    };

    const markAllAsRead = async () => {
        if (!user) return;
        
        // Optimistic update
        const previousNotifications = [...notifications];
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (!error) {
            toast.success('Protocollo Sincronizzato', {
                description: 'Tutte le notifiche sono state segnate come lette.',
                icon: '📡'
            });
        }

        if (error) {
            // Revert on error
            setNotifications(previousNotifications);
            toast.error('Errore di Sincronizzazione', {
                description: 'Impossibile aggiornare lo stato delle notifiche.'
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    const getNotificationStyle = (type: string, isRead: boolean) => {
        if (isRead) return 'bg-white/[0.02] border-white/5 opacity-60 grayscale-[0.5]';
        
        switch (type) {
            case 'success': return 'bg-green-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]';
            case 'warning': return 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]';
            case 'matchday': return 'bg-brand-orange/10 border-brand-orange/30 shadow-[0_0_20px_rgba(255,106,0,0.15)]';
            case 'survival': return 'bg-brand-purple/10 border-brand-purple/30 shadow-[0_0_20px_rgba(157,0,255,0.15)]';
            case 'system': return 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]';
            default: return 'bg-white/5 border-white/10';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <Trophy className="text-brand-gold w-5 h-5 animate-bounce-slow" />;
            case 'warning': return <AlertTriangle className="text-red-500 w-5 h-5 animate-pulse" />;
            case 'matchday': return <Zap className="text-brand-orange w-5 h-5 animate-glow" />;
            case 'survival': return <Skull className="text-brand-purple w-5 h-5" />;
            case 'system': return <Star className="text-cyan-400 w-5 h-5" />;
            default: return <MessageSquare className="text-white/60 w-5 h-5" />;
        }
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div className={`
                fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#0a0a0a]/95 backdrop-blur-[40px] border-l border-white/10 z-[210] shadow-[0_0_100px_rgba(0,0,0,0.8)] transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="p-8 border-b border-white/10 flex items-center justify-between mt-[env(safe-area-inset-top,0px)]">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-brand-orange/20 flex items-center justify-center border border-brand-orange/30 shadow-[0_0_20px_rgba(255,106,0,0.2)]">
                                <Bell className="w-5 h-5 text-brand-orange" />
                            </div>
                            <h2 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter">
                                PROTOCOL <span className="text-brand-orange">INTEL</span>
                            </h2>
                        </div>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mt-3">Sincronizzazione neurale attiva</p>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-2xl transition-all group active:scale-90">
                        <X className="w-6 h-6 text-white/30 group-hover:text-white transition-colors" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-5">
                    {loading && notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-60 space-y-4">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-4 border-brand-orange/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-brand-orange rounded-full animate-spin"></div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 animate-pulse">Accessing Encrypted Data...</span>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-12 py-20 opacity-40 group">
                            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-700">
                                <GhostIcon className="w-12 h-12 text-white/20" />
                            </div>
                            <p className="text-lg font-black text-white uppercase tracking-tighter mb-2">Silenzio Radio</p>
                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">Nessuna attività rilevata nell'arena. Sei al sicuro... per ora.</p>
                        </div>
                    ) : (
                        notifications.map((n, idx) => (
                            <div 
                                key={n.id} 
                                onClick={() => !n.is_read && markAsRead(n.id)}
                                style={{ animationDelay: `${idx * 0.05}s` }}
                                className={`
                                    relative p-5 rounded-[2rem] border transition-all active:scale-[0.97] cursor-pointer group animate-in slide-in-from-right-8 duration-500
                                    ${getNotificationStyle(n.type, n.is_read)}
                                `}
                            >
                                {n.is_read ? (
                                    <span className="absolute top-6 right-6 w-3 h-3 bg-white/10 rounded-full transition-all duration-700 scale-0 opacity-0 z-10 border-2 border-transparent"></span>
                                ) : (
                                    <span className="absolute top-6 right-6 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,1)] z-10 border-2 border-[#0a0a0a] transition-all duration-300"></span>
                                )}
                                <div className="flex gap-5">
                                    <div className={`
                                        w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 border transition-all duration-500 group-hover:scale-110
                                        ${n.is_read ? 'bg-black/40 border-white/5' : 'bg-white/10 border-white/20 shadow-inner'}
                                    `}>
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className={`text-[13px] font-black uppercase tracking-tight ${n.is_read ? 'text-white/40' : 'text-white'}`}>
                                                {n.title}
                                            </h3>
                                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-2 whitespace-nowrap">
                                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className={`text-xs leading-relaxed ${n.is_read ? 'text-gray-600' : 'text-gray-400 font-medium'}`}>
                                            {n.message}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.3em]">
                                                {new Date(n.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                            </span>
                                            {n.is_read && <Check className="w-3 h-3 text-white/10 animate-in zoom-in duration-500" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {notifications.length > 0 && (
                    <div className="p-8 border-t border-white/10 bg-black/40 mb-[env(safe-area-inset-bottom,0px)]">
                        <button 
                            onClick={markAllAsRead}
                            className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[1.5rem] text-[10px] font-black text-white uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg group"
                        >
                            <Check className="w-4 h-4 text-brand-orange transition-all duration-500 group-hover:scale-125" />
                            Sincronizza Tutto
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

const GhostIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
        <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
);
