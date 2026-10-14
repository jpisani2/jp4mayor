-- ===========================================================================
-- Bet Room — all-or-nothing close-out (October 2026)
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste this whole file →
-- Run. Once is enough, and it's safe to run again. The app works with or
-- without it: until it's run, the app does the same checks itself, just with
-- a split-second gap this closes.
--
-- What it adds:
--   * close_game: voids every bet in the game still taking picks and closes
--     the game, in one step — but only if no bet is locked and waiting on a
--     result. It works on the database's board, so a bet posted or locked on
--     another phone a moment before the admin tapped is counted, rather than
--     left open inside a closed game or voided without an answer.
--
-- Nothing here changes existing data.
-- ===========================================================================

begin;

create or replace function public.close_game(g uuid)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  -- Holding the game row makes a bet being posted to it wait (its foreign
  -- key needs the row), and holding the bets waits out a lock in progress.
  perform 1 from games where id = g for update;
  if not found then
    return 'closed';
  end if;
  perform 1 from bets where game_id = g for update;

  if exists (select 1 from bets where game_id = g and status = 'locked') then
    return 'locked';
  end if;

  update bets set status = 'graded', result = 'VOID', graded_at = now()
   where game_id = g and status = 'open';

  update games set phase = 'closed', closed_at = now()
   where id = g and phase <> 'closed';

  return 'closed';
end $$;

grant execute on function public.close_game(uuid) to anon, authenticated;

commit;
