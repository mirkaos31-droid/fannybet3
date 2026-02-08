-- Migration: Recalculate and Resync Matchday Prize Pool
-- This function counts the actual bets for the current open matchday and updates the current_pot accordingly.

CREATE OR REPLACE FUNCTION public.admin_recalculate_current_pot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_matchday_id BIGINT;
    v_bet_count INTEGER;
    v_rollover NUMERIC;
BEGIN
    -- 1. Get the current OPEN matchday
    SELECT id, rollover_pot INTO v_matchday_id, v_rollover
    FROM public.matchdays
    WHERE status = 'OPEN'
    ORDER BY id DESC
    LIMIT 1;

    IF v_matchday_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Nessuna giornata aperta trovata.');
    END IF;

    -- 2. Count bets for this matchday
    SELECT COUNT(*)::INTEGER INTO v_bet_count
    FROM public.bets
    WHERE matchday_id = v_matchday_id;

    -- 3. Update current_pot (current_pot = count of bets + rollover)
    -- Note: Rollover is the starting point, each bet adds 1.
    UPDATE public.matchdays
    SET current_pot = v_rollover + v_bet_count,
        updated_at = now()
    WHERE id = v_matchday_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Montepremi ricalcolato con successo.',
        'matchday_id', v_matchday_id,
        'bets_found', v_bet_count,
        'new_pot', (v_rollover + v_bet_count)
    );
END;
$$;

-- Execute immediately to fix the current discrepancy
-- SELECT public.admin_recalculate_current_pot();
