-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, success, warning, matchday, survival
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to clean old notifications (keep last 50 per user)
CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE id IN (
        SELECT id
        FROM public.notifications
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC
        OFFSET 50
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clean_notifications
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.clean_old_notifications();
