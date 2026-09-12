import { useGameStore } from '@/engine/store';
import { useUiStore } from './uiStore';

type Key = 'seminary' | 'parish' | 'study' | 'posting';

const TEXT: Record<Key, { title: string; from: string; paragraphs: string[] }> = {
  seminary: {
    title: 'A word from the rector',
    from: 'Read on your first evening',
    paragraphs: [
      'You have a room, a desk, and a corridor. The room is the week: click the desk, the shelf, the crucifix, or the bed and you are choosing where your free hours go; the Week sheet on the right says the same thing in a list. The corridor is the house: the library, the director, the rector, the common room where the societies meet.',
      'Nothing here shows you a number. What you give the year to shows up in the evaluations, in what the formators say, and in the men you sit with at dinner. The Formation sheet is the rector\'s view of you; read it once a year and take it as he means it.',
      'Letters come. Some are offers, and declining one is also an answer. The Record keeps what happened each week. The Settings sheet lets you decide how long a week you work and how it wears; the honest setting is the one you will keep.',
    ],
  },
  parish: {
    title: 'A word from the pastor',
    from: 'Left on the kitchen table your first Monday',
    paragraphs: [
      'The rectory is where you live. The office is where the week is planned: the desk is the routine, the phone is the digest of what happened, the file cabinet is the parish. The church is the Mass, the confessional, the sacristy to the chapel. The street is the town and the hospital.',
      'The Week sheet is the routine: the five obligations at a quality you set, and the hours left over for visits, confessions, study, the groups, or the desk. Hours with the people fill the pews, slowly, and the pews fill the basket. The Parish sheet says how the place stands and, for a pastor, what to do with the money. The People sheet is the staff, the groups, the families you have done something for, and the men you were ordained with.',
      'Letters are offers and the chancery\'s answers. The Record is every week, sorted, and the file the diocese keeps on you. The strip under the clock is the liturgical year: the feasts ahead are yours to keep. Hover a standing on the Parish sheet to see what moved it.',
    ],
  },
  study: {
    title: 'A word from the rector of the college',
    from: 'Given with the key to your room',
    paragraphs: [
      'Lectures, the chapel, and the house rule take most of the week. The hours that are left are yours: the thesis, the language, the chapel before the city wakes, and the work on the side that a priest can find in any city, which is the part that decides what kind of priest comes home.',
      'The window and the door are the city. The Week sheet lists everything the city offers and what each hour builds. The thesis is the degree; do not let the city eat it.',
      'The diocese hears how you do here. Letters still come, and some will be about what you will be when you return.',
    ],
  },
  posting: {
    title: 'A word from the man before you',
    from: 'A note in the top drawer',
    paragraphs: [
      'The work takes the week; its shape is yours. The Week sheet says what the hours can go to, and The Work sheet says what the place needs and how it is going. The dials there move slowly, and the diocese reads them.',
      'You still have a room, a chapel, and a phone. Letters still come. The Record keeps the weeks.',
    ],
  },
};

function keyFor(game: NonNullable<ReturnType<typeof useGameStore.getState>['game']>): Key | null {
  if (game.mode.kind !== 'clock' || game.pending.length > 0) return null;
  if (game.parish) return 'parish';
  if (game.study) return game.study.city === 'rome' || game.study.city === 'washington' ? 'study' : 'posting';
  if (game.seminary) return 'seminary';
  return null;
}

/** The first week explained, once per phase, as a note left for the man. */
export default function Briefing() {
  const game = useGameStore((s) => s.game);
  const prefs = useUiStore((s) => s.prefs);
  const setPrefs = useUiStore((s) => s.setPrefs);
  if (!game || !prefs.briefings) return null;
  const key = keyFor(game);
  if (!key || prefs.seen.includes(key)) return null;
  const t = TEXT[key];
  return (
    <div className="scrim absolute inset-0 z-20 flex items-start justify-center overflow-y-auto p-6">
      <div className="paper w-full max-w-xl px-6 py-5">
        <div className="ink-faint text-[11px] uppercase tracking-[0.18em]">{t.from}</div>
        <h3 className="heading mt-1 text-lg">{t.title}</h3>
        {t.paragraphs.map((p, i) => (
          <p key={i} className="mt-3 text-sm leading-relaxed">{p}</p>
        ))}
        <div className="mt-4 flex items-center justify-between">
          <button className="pbtn px-3 py-1 text-sm" onClick={() => setPrefs({ seen: [...prefs.seen, key] })}>Read it</button>
          <button className="pbtn-link text-xs" onClick={() => setPrefs({ briefings: false, seen: [...prefs.seen, key] })}>No more of these</button>
        </div>
      </div>
    </div>
  );
}
