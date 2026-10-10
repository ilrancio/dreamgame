import { FRIEND } from '../../core/walkscene.js';
import { GEAR, PARTY, FISH } from './data.js';

// Gli abitanti di Porto Grigio e quello che dicono, a seconda di dove sei
// arrivato nella storia. s è la scena (SiloDream): ha dialog, saved, e le
// funzioni per dare soldi, oggetti, missioni.

export const NPCS = {
  orsola: { name: 'Orsola', look: { skin: '#d8b090', hair: '#c8c8c8', shirt: '#2a5a3a', pants: '#1a2a20', model: 'suit', feminine: true }, spot: 'orsola' },
  gino: { name: 'Gino', look: { skin: '#c88a60', hair: '#2a1a10', shirt: '#f0ece0', pants: '#3a2a20', model: 'shirt' }, spot: 'inn' },
  rina: { name: 'Rina', look: { skin: '#e0b898', hair: '#8a3a1a', shirt: '#3a6a8a', pants: '#2a2a30', model: 'longsleeve', feminine: true }, spot: 'shop' },
  beppe: { name: 'Beppe', look: { skin: '#b07a50', hair: '#e8e8e8', shirt: '#e8c020', pants: '#2a3a4a', model: 'longsleeve' }, spot: 'boats' },
  ada: { name: 'Ada', look: { skin: '#e0c0a0', hair: '#f0f0f0', shirt: '#6a4a7a', pants: '#3a2a3a', model: 'casual', feminine: true }, spot: 'bench' },
  tobia: { name: 'Tobia', look: { skin: '#e0b089', hair: '#e8c060', shirt: '#c83a3a', pants: '#2a3a6a', model: 'casual' }, spot: 'square', kid: true },
  marta: { name: 'Marta', look: { skin: '#c89070', hair: '#1a1410', shirt: '#c84a2a', pants: '#2a2a30', model: 'longsleeve', feminine: true }, spot: 'harbor' },
  nilo: { name: 'Nilo', look: { skin: '#c89070', hair: '#1a1410', shirt: '#4a6a3a', pants: '#2a2a30', model: 'casual' }, spot: 'homes0' },
};

const TOBIA = [
  'Dicono che il silo l\'abbiano costruito intorno alla balena. Non il contrario.',
  'Quando c\'è il fulmine conta: uno, due, tre... Più conti, più è lontano.',
  'Il faro si è spento quando è salito il Granchio Re. Il guardiano è scappato in barca.',
  'Marta è la più brava con l\'arpione. Più brava di suo padre.',
  'Le pietre in mezzo alla brughiera cantano, quando tira vento. Io ci ho provato a cantare con loro.',
];

export function talk(s, id) {
  const sv = s.saved;
  const q = sv.quests;
  const D = (lines, done) => s.dialog.show(lines, done);
  const N = NPCS[id].name;
  const L = (text) => ({ who: N, text });
  if (id === 'orsola') {
    if (q.main === 0) {
      D(
        [
          L('Forestieri. Con questo tempo. Siete arrivati con l\'idrovolante, eh? Allora siete quelli che aspettavamo.'),
          L('Da quando il dio si è addormentato dentro il silo, la tempesta non finisce più. Lui sogna male, e il mare sogna con lui.'),
          L('Il portone del silo si apre solo con due sigilli. Uno è in cima al Faro Spento, sul capo a est. L\'altro è giù nelle grotte, sotto la scogliera a ovest.'),
          L('Cominciate dal faro. Ma prima passate dall\'Emporio di Rina, e riposate alla locanda di Gino. La brughiera non è più sicura.'),
          L('E prendete con voi Marta, la pescatrice. Suo fratello Nilo è sparito vicino alle grotte, e lei non riesce a stare ferma. Con l\'arpione è la migliore dell\'isola.'),
          L('Prendete anche questi. Non è molto, ma qui non c\'è altro da comprare che coraggio.'),
          { who: 'Marta', text: 'Allora è deciso: vengo con voi. Prima il faro, poi le grotte. E poi riporto a casa quello stupido di mio fratello.' },
          { who: null, text: 'Marta si unisce al gruppo!' },
        ],
        () => {
          s.giveMoney(150);
          s.recruitMarta();
          s.setMain(1);
        },
      );
    } else if (q.main === 1) D([L('Il faro è a est, oltre la brughiera. Seguite il sentiero di terra, e non fermatevi a guardare le pietre troppo a lungo.')]);
    else if (q.main === 2) {
      D(
        [
          L('Il faro... è di nuovo acceso! L\'ho visto dalla finestra. Avete il Sigillo della Luce.'),
          L('Ora le grotte, sotto la scogliera a ovest. Marta, è lì che è sceso tuo fratello. Diceva di sentire cantare, là sotto.'),
          { who: 'Marta', text: 'Lo so. Andiamo a prenderlo.' },
        ],
        () => s.setMain(3),
      );
    } else if (q.main <= 4) D([L('Le grotte sono a ovest, sotto la scogliera. Riportatemi quei due ragazzi.')]);
    else if (q.main === 5) D([L('Nilo è a casa, grazie a voi. E avete i due sigilli.'), L('Il silo vi aspetta, in fondo al molo, a nord. Quando aprirete il portone... non abbiate fretta di svegliarlo.')]);
    else if (q.main === 6) D([L('Il dio dorme ancora. Sveglialo, e lascialo andare. È tutto quello che chiediamo.')]);
    else D([L('La tempesta è finita. Il mare è di nuovo il mare. Porto Grigio non dimenticherà.')]);
    return;
  }
  if (id === 'gino') {
    const sm = q.side.mostro;
    const choices = [
      { label: 'Riposa (20 conchiglie)', fn: () => s.rest(20) },
    ];
    if (!sm) choices.push({ label: 'C\'è qualche lavoro?', fn: () => D([L('Un lavoro? Alla Spiaggia Nera, a sud-est, c\'è un\'anguilla grossa come una barca. Mi ha mangiato due reti e un cane.'), L('Chi la caccia avrà la mia vecchia lama di corallo. E 300 conchiglie.')], () => s.setSide('mostro', 'active')) });
    // il pesce lo compra Gino, per la zuppa (il pesce cristallo no, se serve a Nilo)
    const keep = q.side.cristallo === 'active' ? 'cristallo' : null;
    const fishVal = Object.entries(sv.fish || {}).reduce((t, [f, n]) => t + (f === keep ? 0 : n * FISH[f].price), 0);
    if (fishVal > 0) choices.splice(1, 0, { label: `Vendi il pesce (${fishVal} conchiglie)`, fn: () => D([L('Pesce fresco! Questo va dritto nella zuppa. Ecco a voi.')], () => {
      for (const f of Object.keys(sv.fish)) if (f !== keep) sv.fish[f] = 0;
      s.giveMoney(fishVal);
    }) });
    if (sm === 'killed') choices.unshift({ label: 'L\'Anguillone è stato cacciato', fn: () => D([L('Davvero? L\'ho visto io, il mare là è tornato quieto! Ecco la lama, e i soldi. Brindo alla vostra!')], () => {
      s.giveGear('lama');
      s.giveMoney(300);
      s.setSide('mostro', 'done');
    }) });
    choices.push({ label: 'Niente, grazie', fn: () => {} });
    D([{ who: N, text: q.main >= 7 ? 'Si festeggia! Il letto è gratis, stanotte... no, scherzo. 20 conchiglie.' : 'Benvenuti alla Locanda del Gabbiano! Un letto asciutto, una zuppa calda. Volete riposare?', choices }]);
    return;
  }
  if (id === 'rina') {
    D([L(q.main >= 7 ? 'Senza la tempesta vendo il doppio. Guardate pure!' : 'Benvenuti all\'Emporio. Roba buona, anche se un po\' bagnata.')], () => s.openShop());
    return;
  }
  if (id === 'beppe') {
    const st = q.side.reti;
    if (!st) D([L('Le reti sono a brandelli. Con questo mare non si pesca, e senza reti nemmeno dopo.'), L('Mi servirebbero tre fili di medusa: sono sottili e fortissimi. Le meduse stanno alla Spiaggia Nera, o giù nelle grotte.')], () => s.setSide('reti', 'active'));
    else if (st === 'active') {
      const n = sv.keyItems.filo || 0;
      if (n >= 3) {
        D([L('Tre fili! Perfetti. Ecco, prendete. E due eteri: mia moglie dice che fanno bene alla testa.')], () => {
          sv.keyItems.filo -= 3;
          s.giveMoney(150);
          s.giveItem('etere', 2);
          s.setSide('reti', 'done');
        });
      } else D([L(`Ne hai ${n} su 3. Le meduse temporalesche: se le colpisci col fuoco, il filo resta intero.`)]);
    } else D([L(q.main >= 7 ? 'Le reti tengono, e il mare è calmo. Stasera si pesca!' : 'Le reti tengono! Appena passa la tempesta si pesca.')]);
    return;
  }
  if (id === 'ada') {
    const st = q.side.lanterna;
    if (!st) D([L('Ho perso la mia lanterna nella brughiera, vicino alle pietre che cantano, in mezzo all\'isola.'), L('Mio marito la accendeva per trovare la strada di casa. Ora non c\'è più lui, ma la lanterna... vorrei riaverla.')], () => s.setSide('lanterna', 'active'));
    else if (st === 'active' && sv.keyItems.lanterna) {
      D([L('La mia lanterna! È ancora tiepida... Come se qualcuno l\'avesse accesa da poco.'), L('Prendete questa cerata: era di mio marito. E queste code di fenice. Lui diceva che portano fortuna.')], () => {
        sv.keyItems.lanterna = 0;
        s.giveGear('cerata');
        s.giveItem('fenice', 2);
        s.setSide('lanterna', 'done');
      });
    } else if (st === 'active') D([L('Vicino alle pietre che cantano. Non lasciate che vi cantino troppo nelle orecchie.')]);
    else D([L('La accendo ogni sera, adesso. Anche se nessuno deve tornare.')]);
    return;
  }
  if (id === 'tobia') {
    const st = q.side.conchiglie;
    if (!st && q.main >= 1) {
      D([L('Avevo cinque conchiglie che cantano. Le ho nascoste per l\'isola perché il vento le facesse suonare... e adesso non le trovo più.'), L('Una era vicino al sentiero del faro, una sulla Spiaggia Nera, una sopra le grotte, una a nord, verso il silo, e una appena fuori dal paese. Brillano un po\', rosa.'), L('Se me le riporti ti do il mio tesoro. È un tesoro vero, eh.')], () => s.setSide('conchiglie', 'active'));
      return;
    }
    if (st === 'active') {
      const n = (sv.shells || []).length;
      if (n >= 5) {
        D([L('Tutte e cinque! Ascolta... cantano insieme. È la stessa canzone del silo, ma allegra.'), L('Ecco il mio tesoro: l\'ho trovato sulla spiaggia dopo la tempesta più grande. Due code di fenice, tre granpozioni e tutte le conchiglie che ho risparmiato.')], () => {
          sv.keyItems.conchiglia = 0;
          s.giveItem('fenice', 2);
          s.giveItem('superpozione', 3);
          s.giveMoney(350);
          s.setSide('conchiglie', 'done');
        });
      } else D([L(`Ne hai trovate ${n} su 5. Brillano rosa, un po'. Di notte si sentono cantare.`)]);
      return;
    }
    s.tobiaI = (s.tobiaI || 0) + 1;
    D([L(TOBIA[s.tobiaI % TOBIA.length])]);
    return;
  }
  if (id === 'marta') {
    if (s.region === 'grotte') {
      D(
        [
          L('Siete voi quelli del faro? L\'ho visto riaccendersi da qui sotto.'),
          L('Nilo è laggiù, in fondo. Lo sento cantare... o forse non è lui. Da sola non ce la faccio: ci sono troppe di quelle cose.'),
          L('Vengo con voi. Ho il mio arpione, e so dove colpire.'),
          { who: null, text: 'Marta si unisce al gruppo!' },
        ],
        () => s.recruitMarta(),
      );
    } else D([L('Mio fratello Nilo è sparito vicino alle grotte. Dice che là sotto qualcuno canta. Parlate con Orsola: se andate verso il silo, vengo con voi.')]);
    return;
  }
  if (id === 'nilo') {
    const st = q.side.cristallo;
    if (!st) {
      D([L('Mi avete tirato fuori da quel bozzolo... Laggiù, nel buio, la Madre cantava la stessa canzone che si sente vicino al silo.'), L('Ma prima di lei, nel lago sotterraneo, ho visto un pesce trasparente. Di vetro. Con un cuore azzurro che batteva.'), L('Il pesce cristallo. Nessuno ci crede. Se riesci a pescarlo, portamelo: voglio vederlo ancora una volta. Marta ti presta la lenza.')], () => s.setSide('cristallo', 'active'));
    } else if (st === 'active' && sv.fish?.cristallo > 0) {
      D([L('È lui... È vero. Guarda il cuore, come batte.'), L('Lo ributto nel lago, domani. Ma prima voglio che lo veda Marta. E tu prendi questa: la lenza d\'argento di nostro padre. Con questa non scappa niente.')], () => {
        sv.fish.cristallo--;
        sv.keyItems.lenza = 1;
        s.giveMoney(400);
        s.setSide('cristallo', 'done');
      });
    } else if (st === 'active') D([L('Il pesce cristallo sta nel lago sotterraneo, nelle grotte. Abbocca poco, e quando abbocca tira come un matto.')]);
    else D([L('Credo che il dio sognasse anche lei, la Madre. Che sognasse tutti noi. Anche il pesce cristallo.')]);
  }
}

export function gearName(id) {
  return GEAR[id]?.name || id;
}

export function memberName(id) {
  return PARTY[id]?.name || id;
}

export { FRIEND };
