-- Migration: Fixed Pot Sync (+1 per bet) and Robust Recalculation
-- This fix ensures current_pot counts EXACTLY +1 for every bet,
-- regardless of whether it's a Base or Super Jackpot bet.

-- 1. Fix existing NULL values and ensure defaults
UPDATE public.matchdays SET current_pot = 0 WHERE current_pot IS NULL;
UPDATE public.matchdays SET rollover_pot = 0 WHERE rollover_pot IS NULL;

ALTER TABLE public.matchdays ALTER COLUMN current_pot SET DEFAULT 0;
ALTER TABLE public.matchdays ALTER COLUMN rollover_pot SET DEFAULT 0;
ALTER TABLE public.matchdays ALTER COLUMN current_pot SET NOT NULL;
ALTER TABLE public.matchdays ALTER COLUMN rollover_pot SET NOT NULL;

-- 2. Update/Define the robust recalculation function (Fixed +1 per bet)
CREATE OR REPLACE FUNCTION public.admin_recalculate_current_pot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_matchday_id BIGINT;
    v_bet_count BIGINT;
    v_rollover NUMERIC;
BEGIN
    -- Get the current OPEN matchday
    SELECT id, rollover_pot INTO v_matchday_id, v_rollover
    FROM public.matchdays
    WHERE status = 'OPEN'
    ORDER BY id DESC
    LIMIT 1;

    IF v_matchday_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Nessuna giornata aperta trovata.');
    END IF;

    -- Count total bets (+1 per bet)
    SELECT COUNT(*) INTO v_bet_count
    FROM public.bets
    WHERE matchday_id = v_matchday_id;

    -- Update current_pot (absolute calculation)
    UPDATE public.matchdays
    SET current_pot = COALESCE(v_rollover, 0) + v_bet_count,
        updated_at = now()
    WHERE id = v_matchday_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Montepremi ricalcolato con successo.',
        'matchday_id', v_matchday_id,
        'new_pot', (COALESCE(v_rollover, 0) + v_bet_count)
    );
END;
$$;

-- 3. Update the trigger function for fixed +1 increment
CREATE OR REPLACE FUNCTION public.sync_matchday_pot_on_bet()
RETURNS TRIGGER AS $$
BEGIN
    -- ALWAYS increment current_pot by 1, regardless of Super Jackpot
    UPDATE public.matchdays
    SET current_pot = COALESCE(current_pot, 0) + 1,
        updated_at = now()
    WHERE id = NEW.matchday_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-apply trigger
DROP TRIGGER IF EXISTS tr_sync_matchday_pot ON public.bets;
CREATE TRIGGER tr_sync_matchday_pot
AFTER INSERT ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.sync_matchday_pot_on_bet();

-- 5. Force a final recalculation
SELECT public.admin_recalculate_current_pot();
