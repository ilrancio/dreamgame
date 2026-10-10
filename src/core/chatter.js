// Le chiacchiere dell'amico: quando si cammina da un po' senza che succeda
// niente, ogni tanto dice qualcosa. A volte sul posto dove siete, a volte su
// un altro sogno che avete fatto insieme (se l'avete fatto davvero).

// here: il sogno in cui siete adesso (non si ricorda di quello)
export function memories(P, here) {
  const out = [];
  const add = (where, ok, ...lines) => {
    if (where !== here && ok) out.push(...lines);
  };
  add('hotel', P.hotel?.reached, 'Ti ricordi il demone nel campo? Ogni tanto lo sogno ancora. Solo le gambe, enormi.', 'Mi manca la suite. Il tè, il caminetto... Stasera ci torniamo?');
  add('hotel', (P.hotel?.gnomesTotal || 0) > 0, 'Gli gnomi della hall... quanti erano? Mille? Io ancora li sento correre.');
  add('hotel', (P.hotel?.prizes || []).length, 'Il premio della sala giochi è ancora sulla mensola della suite. Bello, eh?');
  add('esterno', P.esterno?.coffee, 'Il caffè di Sant\'Onirio... non ne ho mai bevuto uno così buono. Neanche da sveglio.');
  add('esterno', P.esterno?.bell, 'Mi è rimasto in testa il suono della campana del borgo. Dong. Dong. Dong.');
  add('centro', P.centro?.lay, 'Quel commesso del negozio di retrogames... era così calmo. Vorrei essere calmo così.');
  add('digitale', P.digitale?.hero, 'Scintilla sta bene, nella chiavetta? A volte la sento ronzare in tasca.');
  add('aeroporto', P.aeroporto?.flown, 'L\'aeroporto era così vuoto. Chissà chi altro ci passa, la notte.');
  add('costa', P.costa?.beach, 'Quanta gente c\'era alla Spiaggia Grande. E nessuno che parlava.');
  add('spiaggia', P.spiaggia?.feet, 'Ti ricordi l\'acqua gelida alla spiaggia d\'inverno? Ahah, eri matto.');
  add('isola', P.isola?.plane, 'Il Pellicano... volare era bellissimo. Prima o poi ci torniamo, sull\'isola.');
  add('isola', P.isola?.boss, 'Il Gabbiano di Ferro lo abbiamo battuto noi. Ancora non ci credo.');
  add('silo', P.silo?.god, 'Penso spesso alla balena di luce. Chissà dove nuota, adesso.');
  add('silo', P.silo?.niloSaved, 'Chissà se Marta e Nilo sono andati a pescare. Con il mare calmo, adesso.');
  add('silo', (P.silo?.abyss?.best || 0) >= 5, 'L\'Abisso sotto il silo continua ancora, vero? Non finisce mai.');
  return out;
}
