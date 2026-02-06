-- Migration: Automated Pot Synchronization Trigger
-- This trigger ensures matchdays.current_pot is always in sync with the number of bets

-- 1. Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.sync_matchday_pot_on_bet()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment current_pot of the matchday associated with the new bet
    UPDATE public.matchdays
    SET current_pot = current_pot + 1,
        updated_at = now()
    WHERE id = NEW.matchday_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the bets table
DROP TRIGGER IF EXISTS tr_sync_matchday_pot ON public.bets;
CREATE TRIGGER tr_sync_matchday_pot
AFTER INSERT ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.sync_matchday_pot_on_bet();

-- 3. (Optional) Cleanup the old RPC if no longer needed anywhere
-- DROP FUNCTION IF EXISTS public.increment_matchday_pot(BIGINT, NUMERIC);
