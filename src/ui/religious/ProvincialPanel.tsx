import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { membersOf, playerIsProvincial } from '@/systems/religious/house';
import { housesUnderFloor, moneyWord, provincialActs, provincialHouses, provincialMen } from '@/systems/religious/provincialDesk';
import { PROVINCE } from '@/generation/province';
import { religiousOrder } from '@/content/religious';
import Panel from '../Panel';
import { FoldHeading, useFold } from '../Sheet';

const KIND: Record<string, string> = { priory: 'priory', studium: 'house of studies', novitiate: 'novitiate', parish: 'parish house', school: 'school', mission: 'mission', curia: 'the curia' };

/**
 * The provincial's desk: the province's houses and money in one glance,
 * and the acts in his gift while he holds the office. Friar round Q3.
 */
export default function ProvincialPanel() {
  const game = useGameStore((s) => s.game);
  const act = useGameStore((s) => s.provincialAct);
  const line = useGameStore((s) => s.lastProvincialLine);
  const [housesOpen, toggleHouses] = useFold('provincial:houses', true);
  const [man, setMan] = useState('');
  const [house, setHouse] = useState('');
  if (!game?.religious || !game.province || !playerIsProvincial(game)) return null;
  const p = game.province;
  const order = religiousOrder(game.religious.order);
  const houses = provincialHouses(game);
  const men = provincialMen(game);
  const acts = provincialActs(game);
  const under = housesUnderFloor(game);
  const title = order.governance.provincialTitle;
  const hostility = p.factions.hostility >= 60 ? 'at each other\'s throats' : p.factions.hostility >= 35 ? 'watchful of each other' : 'at peace';
  return (
    <Panel title={`The ${title}'s desk`}>
      {line && <p className="mb-3 rounded border rule bg-white/30 p-3 text-sm italic">{line}</p>}
      <p className="text-sm leading-relaxed">
        {p.name}: {houses.length} houses, {p.friarIds.length} men, {p.trajectory}. The money is {moneyWord(p.finances.balance)} (${p.finances.balance.toLocaleString()}), with {Math.round(p.finances.retirementBurden * 100)}% of the men retired on it. The two wings are {hostility}.
      </p>
      <p className="ink-faint mt-1 text-xs">{p.complication} {p.line}</p>
      <div className="mt-3">
        <FoldHeading open={housesOpen} onToggle={toggleHouses} title="The houses" summary={under.length ? `${under.length} under the floor` : 'every house above its floor'} />
        {housesOpen && (
          <ul className="mt-1 flex flex-col gap-0.5 text-xs">
            {houses.map((h) => {
              const n = membersOf(game, h).length + (game.religious!.houseId === h.id ? 1 : 0);
              const floor = PROVINCE.members[h.kind][0];
              return (
                <li key={h.id} className="flex justify-between gap-2">
                  <span>{h.name} <span className="ink-faint">· {KIND[h.kind] ?? h.kind}</span></span>
                  <span className={'shrink-0 ' + (n < floor ? 'ink-wine' : 'ink-muted')}>{n} men{n < floor ? ` (floor ${floor})` : ''} · ${h.budget.toLocaleString()} · cohesion {Math.round(h.cohesion)}, observance {Math.round(h.observance)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="ink-muted">Name a man:</span>
        <select className="pinput text-xs" value={man} onChange={(e) => setMan(e.target.value)}>
          <option value="">choose one</option>
          {men.map(({ npc, house: h }) => <option key={npc.id} value={npc.id}>{npc.title} {npc.name.first} {npc.name.last}, {h.name}</option>)}
        </select>
        <span className="ink-muted">a house:</span>
        <select className="pinput text-xs" value={house} onChange={(e) => setHouse(e.target.value)}>
          <option value="">choose one</option>
          {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {acts.map((o) => {
          const needsHouse = o.def.target === 'house' || o.def.target === 'house_under_floor' || o.def.target === 'house_with_building' || o.def.target === 'man_and_house';
          const needsMan = o.def.target === 'man_and_house';
          const ready = o.available && (!needsHouse || house) && (!needsMan || man);
          return (
            <li key={o.def.id} className="flex flex-col gap-1 rounded border rule bg-white/30 px-3 py-2">
              <span className="font-medium">{o.def.label}</span>
              <span className="ink-muted text-xs">{o.def.blurb}</span>
              {o.available ? (
                <button className="pbtn self-start px-2 py-0.5 text-xs" disabled={!ready} title={ready ? '' : needsMan && !man ? 'Name a man above' : 'Name a house above'} onClick={() => act(o.def.id, { ...(needsMan ? { npcId: man } : {}), ...(needsHouse ? { houseId: house } : {}) })}>
                  Do it
                </button>
              ) : (
                <span className="ink-faint text-xs">{o.why}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
