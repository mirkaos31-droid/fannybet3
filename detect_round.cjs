const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabase = createClient(
  'https://rzyscsvzentuplsgoipv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU'
);

// Serie A 2026-27 schedule (round 6 onwards should help us detect current)
// We'll manually check some rounds from the schedule file
const fs = require('fs');
const content = fs.readFileSync(path.join(__dirname, 'src/data/serieA2026_2027.ts'), 'utf-8');

// Parse the rounds manually
const rounds = {};
let current = null;
const lines = content.split('\n');
for (const line of lines) {
  const roundMatch = line.match(/"(\d+)":\s*\[/);
  if (roundMatch) { current = parseInt(roundMatch[1]); rounds[current] = []; }
  const homeMatch = line.match(/"home":\s*"([^"]+)"/);
  const awayMatch = line.match(/"away":\s*"([^"]+)"/);
  if (homeMatch && current !== null) {
    if (!rounds[current]._lastHome) rounds[current]._lastHome = homeMatch[1];
  }
  if (awayMatch && current !== null && rounds[current]._lastHome) {
    rounds[current].push({ home: rounds[current]._lastHome, away: awayMatch[1] });
    delete rounds[current]._lastHome;
  }
}

async function detect() {
  const { data: allMds } = await supabase
    .from('matchdays')
    .select('id, matches, status')
    .order('id', { ascending: true });

  const archived = allMds.filter(m => m.status === 'ARCHIVED' && m.matches && m.matches.length >= 5);
  const open = allMds.filter(m => m.status === 'OPEN' && m.matches && m.matches.length >= 5);

  function detectRound(md) {
    const mdMatches = (md.matches || []).filter(m => m.home && m.away);
    for (const [r, schedule] of Object.entries(rounds)) {
      if (!Array.isArray(schedule) || schedule.length < 5) continue;
      const matched = mdMatches.filter(m =>
        schedule.some(s =>
          s.home.trim().toUpperCase() === (m.home || '').trim().toUpperCase() &&
          s.away.trim().toUpperCase() === (m.away || '').trim().toUpperCase()
        )
      ).length;
      if (matched >= 5) return parseInt(r);
    }
    return null;
  }

  const archivedRounds = [];
  for (const md of archived) {
    const r = detectRound(md);
    if (r !== null) archivedRounds.push(r);
  }
  archivedRounds.sort((a, b) => a - b);

  let currentOpenRound = null;
  for (const md of open) {
    const r = detectRound(md);
    if (r !== null) { currentOpenRound = r; break; }
  }

  console.log('Archived Serie A rounds:', archivedRounds);
  console.log('Current open round:', currentOpenRound);
  const lastCompletedRound = archivedRounds.length > 0 ? Math.max(...archivedRounds) : 0;
  console.log('Last completed round:', lastCompletedRound);
  const remainingRounds = 38 - lastCompletedRound;
  console.log('Remaining rounds from end of season:', remainingRounds);
}

detect().catch(console.error);
