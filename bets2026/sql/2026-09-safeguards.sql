-- ===========================================================================
-- Bet Room — database safeguards (September 2026)
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste this whole file →
-- Run. Once is enough, and it's safe to run again. The app works with or
-- without it: until it's run, the app does the same checks itself, just with
-- a split-second gap this closes.
--
-- What it adds:
--   * All-or-nothing versions of the multi-step jobs: posting a bet with the
--     caller's pick, setting up a game with its board, kickoff, and locking
--     a bet (which re-checks both sides are covered at the moment it locks).
--   * Guarded deletes: a bet is only deleted if nobody else has picked it,
--     and a game only while no bet has a real grade.
--   * A rule the database enforces itself: phones can't make or change a
--     pick on a bet that isn't open. Admin tools (merge, undo, moving a stray
--     pick) are unaffected.
--   * The settlement views updated to match the app: a bet with nobody on
--     one side settles as a void, and voids don't count in anyone's totals.
--
-- Nothing here changes existing data.
-- ===========================================================================

begin;

-- --- post a bet together with the caller's own pick -----------------------

create or replace function public.post_bet(bet jsonb, side text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into bets (game_id, category, is_pregame, body, side_a, side_b, p,
                    odds_edited, even_money, proposer_id, status)
  values ((bet->>'game_id')::uuid,
          bet->>'category',
          coalesce((bet->>'is_pregame')::boolean, false),
          bet->>'body', bet->>'side_a', bet->>'side_b',
          (bet->>'p')::numeric,
          coalesce((bet->>'odds_edited')::boolean, false),
          coalesce((bet->>'even_money')::boolean, false),
          (bet->>'proposer_id')::uuid,
          'open')
  returning id into new_id;

  insert into picks (bet_id, player_id, side)
  values (new_id, (bet->>'proposer_id')::uuid, post_bet.side::pick_side);

  return new_id;
end $$;

-- --- set up a game and its pregame board together -------------------------
-- The existing one_open_game index still refuses a second open game.

create or replace function public.create_game_with_board(game jsonb, board jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  gid uuid;
begin
  insert into games (kickoff_date, home_team, away_team, favorite, spread,
                     total, base_stake, phase)
  values ((game->>'kickoff_date')::date,
          game->>'home_team', game->>'away_team', game->>'favorite',
          (game->>'spread')::numeric, (game->>'total')::numeric,
          (game->>'base_stake')::numeric,
          'pregame')
  returning id into gid;

  insert into bets (game_id, category, is_pregame, body, side_a, side_b, p,
                    odds_edited, even_money, proposer_id, status)
  select gid,
         r->>'category',
         coalesce((r->>'is_pregame')::boolean, true),
         r->>'body', r->>'side_a', r->>'side_b',
         (r->>'p')::numeric,
         coalesce((r->>'odds_edited')::boolean, false),
         coalesce((r->>'even_money')::boolean, false),
         nullif(r->>'proposer_id', '')::uuid,
         'open'
    from jsonb_array_elements(board) r;

  return gid;
end $$;

-- --- lock one bet ----------------------------------------------------------
-- Holds the bet while it checks both sides and marks the silent out, so a
-- side-switch can't sneak in between the check and the lock. Returns
-- 'locked', 'one_sided', or 'not_open' (already locked, graded or gone).

create or replace function public.lock_bet(b uuid, present uuid[])
returns text
language plpgsql security definer set search_path = public
as $$
declare
  st bet_status;
begin
  select status into st from bets where id = b for update;
  if st is null or st <> 'open' then
    return 'not_open';
  end if;

  if not exists (select 1 from picks where bet_id = b and side = 'A')
     or not exists (select 1 from picks where bet_id = b and side = 'B') then
    return 'one_sided';
  end if;

  -- A real pick always beats an automatic out.
  insert into picks (bet_id, player_id, side, auto)
  select b, pid, 'OUT', true from unnest(coalesce(present, '{}')) pid
  on conflict (bet_id, player_id) do nothing;

  update bets set status = 'locked', locked_at = now() where id = b;
  return 'locked';
end $$;

-- --- kickoff ---------------------------------------------------------------
-- Every open pregame bet with both sides covered locks (silent players
-- marked out); every one-sided one voids; the game goes live. One step.

create or replace function public.kick_off(g uuid, present uuid[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  locked_n int := 0;
  voided_n int := 0;
begin
  perform 1 from games where id = g for update;

  for r in select id from bets
            where game_id = g and is_pregame and status = 'open'
            for update
  loop
    if exists (select 1 from picks where bet_id = r.id and side = 'A')
       and exists (select 1 from picks where bet_id = r.id and side = 'B') then
      insert into picks (bet_id, player_id, side, auto)
      select r.id, pid, 'OUT', true from unnest(coalesce(present, '{}')) pid
      on conflict (bet_id, player_id) do nothing;
      update bets set status = 'locked', locked_at = now() where id = r.id;
      locked_n := locked_n + 1;
    else
      update bets set status = 'graded', result = 'VOID', graded_at = now()
       where id = r.id;
      voided_n := voided_n + 1;
    end if;
  end loop;

  update games set phase = 'live', kicked_off_at = now()
   where id = g and phase = 'pregame';

  return jsonb_build_object('locked', locked_n, 'voided', voided_n);
end $$;

-- --- delete a bet nobody else has picked -----------------------------------
-- keep_player is the caller (their own pick doesn't count); null for a
-- random bet from the big screen, which nobody owns. True if it's gone.

create or replace function public.delete_bet_if_unpicked(b uuid, keep_player uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  st bet_status;
begin
  select status into st from bets where id = b for update;
  if not found then
    return true;
  end if;
  if st <> 'open' then
    return false;
  end if;
  if exists (select 1 from picks
              where bet_id = b and player_id is distinct from keep_player) then
    return false;
  end if;
  delete from bets where id = b;
  return true;
end $$;

-- --- delete a game that nothing has been graded in -------------------------

create or replace function public.delete_game_if_ungraded(g uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from games where id = g for update;
  if not found then
    return true;
  end if;
  perform 1 from bets where game_id = g for update;
  if exists (select 1 from bets
              where game_id = g and status = 'graded' and result <> 'VOID') then
    return false;
  end if;
  delete from games where id = g;   -- cascades bets, picks, attendance
  return true;
end $$;

grant execute on function
  public.post_bet(jsonb, text),
  public.create_game_with_board(jsonb, jsonb),
  public.lock_bet(uuid, uuid[]),
  public.kick_off(uuid, uuid[]),
  public.delete_bet_if_unpicked(uuid, uuid),
  public.delete_game_if_ungraded(uuid)
to anon, authenticated;

-- --- no picks on a bet that isn't open --------------------------------------
-- Applies to phones (the anon role). The functions above and the roster
-- tools run as the database owner, so merging, undoing and moving a stray
-- pick still work on locked and graded bets. Only new picks and side
-- changes are checked; reassigning a pick to another player is not.
-- FOR SHARE waits for a lock in progress, so a pick can't slip in mid-lock.

create or replace function public.picks_only_on_open_bets()
returns trigger
language plpgsql
as $$
declare
  st bet_status;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  select status into st from bets where id = new.bet_id for share;
  if st is distinct from 'open' then
    raise exception 'This bet isn''t taking picks any more.';
  end if;
  return new;
end $$;

drop trigger if exists picks_only_on_open_bets on picks;
create trigger picks_only_on_open_bets
  before insert or update of side on picks
  for each row execute function public.picks_only_on_open_bets();

-- --- settlement views, matching the app -------------------------------------
-- Same columns as before, so everything built on them keeps working.

create or replace view public.settlements as
select s.bet_id,
       s.player_id,
       s.side,
       s.risk,
       b.game_id,
       b.result,
       b.graded_at,
       case
         -- a push, a void, or nobody on one side: everyone gets their risk back
         when b.result in ('PUSH', 'VOID') or p.backers_a = 0 or p.backers_b = 0
           then 0::numeric
         when b.result::text = s.side::text
           then p.pot / (case when s.side = 'A' then p.backers_a
                              else p.backers_b end)::numeric - s.risk
         else - s.risk
       end as net
  from bet_stakes s
  join bets b on b.id = s.bet_id
  join bet_pots p on p.bet_id = s.bet_id
 where b.status = 'graded';

-- Voids (including one-sided bets) don't count as a bet, a push, or risk.
create or replace view public.game_totals as
select s.game_id,
       s.player_id,
       count(*) as bets,
       count(*) filter (where s.result::text = s.side::text) as wins,
       count(*) filter (where s.result in ('A', 'B')
                          and s.result::text <> s.side::text) as losses,
       count(*) filter (where s.result = 'PUSH') as pushes,
       sum(s.risk) as risked,
       sum(s.net) as net,
       max(s.net) as best_bet,
       min(s.net) as worst_bet
  from settlements s
  join bet_pots p on p.bet_id = s.bet_id
 where s.result <> 'VOID' and p.backers_a > 0 and p.backers_b > 0
 group by s.game_id, s.player_id;

commit;
