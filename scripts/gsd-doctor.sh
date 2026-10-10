#!/usr/bin/env bash
#
# gsd-doctor — integrity check for the GSD planning state.
#
# Written after the 2026-10-10 incident, in which `.planning/` was gitignored in
# full and ROADMAP.md, STATE.md, PROJECT.md and two phase records were lost with
# no recovery path. The roadmap had to be rebuilt from the master document.
#
# The guards in lefthook.yml stop planning state from becoming unprotected. This
# script catches the state that results when something has already gone wrong, or
# when the planning record and the repository have quietly drifted apart.
#
# Usage:
#   scripts/gsd-doctor.sh            # report, exit 1 if any check fails
#   scripts/gsd-doctor.sh --quiet    # only print failures
#
# Exit codes: 0 all clear, 1 problems found, 2 not a GSD project.

set -uo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

FAILURES=0
WARNINGS=0

# Everything goes to stdout so the report reads in order when piped or
# captured. Only the final verdict goes to stderr, so a caller can separate
# "here is the report" from "here is the exit status".
fail() {
  printf '  ✗ %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

warn() {
  printf '  ! %s\n' "$1"
  WARNINGS=$((WARNINGS + 1))
}

ok() {
  [ "$QUIET" -eq 1 ] || printf '  ✓ %s\n' "$1"
}

section() {
  [ "$QUIET" -eq 1 ] || printf '\n%s\n' "$1"
}

# ── Preflight ──────────────────────────────────────────────────────────────────
if [ ! -d .planning ]; then
  echo "Not a GSD project — no .planning/ directory." >&2
  exit 2
fi

# ── 1. Structure ───────────────────────────────────────────────────────────────
# The incident file set. Each of these was lost at least once.
section "1. Planning structure"
for f in .planning/ROADMAP.md .planning/STATE.md .planning/PROJECT.md; do
  if [ -f "$f" ]; then
    ok "$f exists"
  else
    fail "$f is missing — this is what was lost on 2026-10-10"
    printf "      recover with: git show aece01a^:%s > %s\n" "$f" "$f"
  fi
done

# ── 2. Protection ──────────────────────────────────────────────────────────────
# Being on disk is not enough. A gitignored planning file is unprotected: it
# survives nothing — not a reset, not a clean, not a new clone, not a new machine.
section "2. Planning state is protected from loss"
for f in .planning/ROADMAP.md .planning/STATE.md .planning/PROJECT.md; do
  [ -e "$f" ] || continue

  if git check-ignore -q --no-index "$f" 2>/dev/null; then
    fail "$f is gitignored — it would be silently deleted by a reset or clean"
  elif ! git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    fail "$f is not tracked — it would not survive a fresh clone"
  else
    ok "$f is tracked and not ignored"
  fi
done

# ── 3. Roadmap vs disk ─────────────────────────────────────────────────────────
# Every phase in the roadmap should have a directory, and every directory should
# be in the roadmap. Either drift means a phase is invisible to /gsd-progress.
section "3. Roadmap matches the phase directories"
declared=$(grep -oE '^#{2,4}[[:space:]]*Phase[[:space:]]+[0-9]+[A-Z]?:' .planning/ROADMAP.md 2>/dev/null \
             | grep -oE '[0-9]+' | sort -u -n)

if [ -z "$declared" ]; then
  fail "no phases found in ROADMAP.md — it may be empty or malformed"
else
  ok "roadmap declares phases: $(echo "$declared" | tr '\n' ' ')"

  # On-disk phase numbers, collected once. A plain glob rather than
  # `find -regex`, because GNU find's -regex is a basic regex where `+` is a
  # literal and silently matches nothing.
  ondisk=""
  for d in .planning/phases/*/; do
    [ -d "$d" ] || continue
    bnum=$(basename "$d" | grep -oE '^[0-9]+')
    [ -n "$bnum" ] && ondisk="$ondisk $((10#$bnum))"
  done

  for n in $declared; do
    if echo "$ondisk" | tr ' ' '\n' | grep -qx "$n"; then
      ok "phase $n has a directory"
    elif grep -qE "^- \[[xX]\][[:space:]]*\*\*Phase[[:space:]]+$n:" .planning/ROADMAP.md 2>/dev/null; then
      # Marked complete with nothing on disk — the Phase 02 shape, which is how
      # work ends up shipped with nothing tracking it.
      fail "phase $n is marked complete but has no directory in .planning/phases/"
    else
      ok "phase $n not started yet (no directory — expected)"
    fi
  done

  # Directories with no roadmap entry are worse: the work happened but nothing
  # tracks it, which is exactly how Phase 02 ended up undocumented.
  for n in $ondisk; do
    if ! echo "$declared" | grep -qx "$n"; then
      warn "a phase $n directory exists but is not in ROADMAP.md — its work is untracked"
    fi
  done
fi

# ── 4. STATE.md freshness ──────────────────────────────────────────────────────
# STATE.md is the file agents trust first. A stale one is worse than a missing
# one, because it is believed. The recovered copy on 2026-10-10 claimed Phase 01
# was at 0% while Phases 01 and 02 were already merged.
section "4. STATE.md is not stale"
if [ -f .planning/STATE.md ]; then
  commits_since=$(git log --oneline -- .planning/STATE.md 2>/dev/null | wc -l | tr -d ' ')
  head_commits=$(git rev-list --count HEAD 2>/dev/null || echo 0)
  last_touch=$(git log -1 --format=%ct -- .planning/STATE.md 2>/dev/null || echo 0)
  now=$(date +%s)
  age_days=$(( (now - last_touch) / 86400 ))

  if [ "$last_touch" = "0" ]; then
    warn "STATE.md has never been committed — its accuracy is unverifiable"
  elif [ "$age_days" -gt 60 ]; then
    warn "STATE.md last updated ${age_days} days ago ($head_commits commits in the repo)"
    printf '      it is believed by every agent that reads it — verify before planning\n'
  else
    ok "STATE.md updated ${age_days} days ago"
  fi

  # Cross-check the claimed completed count against the roadmap checkmarks.
  claimed=$(grep -oE 'completed_phases:[[:space:]]*[0-9]+' .planning/STATE.md 2>/dev/null | grep -oE '[0-9]+' | head -1)
  actual=$(grep -cE '^- \[[xX]\][[:space:]]*\*\*Phase' .planning/ROADMAP.md 2>/dev/null || echo 0)
  if [ -n "$claimed" ] && [ "$claimed" != "$actual" ]; then
    fail "STATE.md claims $claimed completed phases; ROADMAP.md marks $actual as complete"
  else
    ok "STATE.md and ROADMAP.md agree on $actual completed phase(s)"
  fi
fi

# ── 5. Unresolved checkpoints ──────────────────────────────────────────────────
# /gsd-progress --next hard-stops on these. They mean a previous session left
# work mid-flight and nobody resolved it.
section "5. No unresolved session checkpoints"
checkpoints=$(find .planning -name '.continue-here.md' 2>/dev/null)
if [ -n "$checkpoints" ]; then
  fail "unresolved checkpoint(s) — read and resolve before advancing:"
  echo "$checkpoints" | sed "s/^/      /"
else
  ok "no .continue-here.md checkpoints"
fi

# ── 6. Orphaned context — discussed but never planned ──────────────────────────
# The blind spot that hid 01B.
#
# 01B-CONTEXT.md was written on 2026-06-19 with 17 prioritised items and an
# execution order. It was never planned and never executed. Because the phase it
# lived inside was marked complete, and because this script originally only
# looked for "plans without summaries", nothing reported it — an entire
# unexecuted remediation backlog sat invisible while the doctor said "all clear".
#
# The shape is a CONTEXT with no PLAN beside it: a discussion that never became
# work. That is a different failure from an unfinished plan and needs its own check.
section "6. No context was left unexecuted"
for d in .planning/phases/*/; do
  [ -d "$d" ] || continue
  dir=$(basename "$d")

  for ctx in "$d"*-CONTEXT.md; do
    [ -f "$ctx" ] || continue
    base=$(basename "$ctx" -CONTEXT.md)

    # Match by name prefix, NOT by "some plan exists in the directory". Phase 01
    # has four wave plans (01-01 … 01-04) which have nothing to do with 01B's 17
    # remediation items — a directory-level check credits 01B with work that does
    # not cover it, which is the exact blind spot this check exists to close.
    # A context named `01B` is covered only by plans named `01B-*`.
    covered=$(find "$d" -maxdepth 1 -name "$base-*PLAN.md" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$covered" -gt 0 ]; then
      ok "$dir $base is covered by $covered plan(s)"
    else
      # Severity depends on whether the roadmap still intends the work.
      num=$(echo "$dir" | grep -oE '^[0-9]+')
      if [ -n "$num" ] && grep -qE "^- \[[xX]\][[:space:]]*\*\*Phase[[:space:]]+$((10#$num)):" \
           .planning/ROADMAP.md 2>/dev/null; then
        fail "$dir $base-CONTEXT.md was scoped but never planned — and its phase is marked complete"
        printf '      the work will never be picked up again\n' >&2
      else
        warn "$dir $base-CONTEXT.md has no plan yet — scoped but not planned"
      fi
    fi
  done
done

# ── 7. Completed phases have records ───────────────────────────────────────────
# A phase marked complete whose plans lack summaries means work shipped without
# a record.
section "7. Completed phases have records"
for d in .planning/phases/*/; do
  [ -d "$d" ] || continue
  dir=$(basename "$d")
  num=$(echo "$dir" | grep -oE '^[0-9]+')
  [ -n "$num" ] || continue
  num=$((10#$num))

  # Is this phase marked complete in the roadmap?
  if ! grep -qE "^- \[[xX]\][[:space:]]*\*\*Phase[[:space:]]+$num:" .planning/ROADMAP.md 2>/dev/null; then
    continue
  fi

  plans=$(find "$d" -name '*-PLAN.md' 2>/dev/null | wc -l | tr -d ' ')
  summaries=$(find "$d" -name '*-SUMMARY.md' 2>/dev/null | wc -l | tr -d ' ')

  if [ "$plans" -eq 0 ]; then
    warn "$dir is marked complete but has no PLAN.md — no record of what was planned"
  elif [ "$summaries" -lt "$plans" ]; then
    warn "$dir marked complete: $summaries summary/summaries for $plans plans"
    find "$d" -name '*-PLAN.md' 2>/dev/null | while read -r p; do
      s="${p%-PLAN.md}-SUMMARY.md"
      [ -f "$s" ] || printf '      no summary for %s\n' "$(basename "$p")"
    done
  else
    ok "$dir has $summaries/$plans summaries"
  fi
done

# ── Verdict ────────────────────────────────────────────────────────────────────
printf '\n%s\n' "──────────────────────────────────────────────────────────"
if [ "$FAILURES" -gt 0 ]; then
  printf 'gsd-doctor: %d problem(s), %d warning(s)\n' "$FAILURES" "$WARNINGS" >&2
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  printf 'gsd-doctor: all clear, %d warning(s)\n' "$WARNINGS"
  exit 0
else
  printf 'gsd-doctor: clean\n'
  exit 0
fi
