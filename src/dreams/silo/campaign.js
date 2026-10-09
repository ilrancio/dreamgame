import { FRIEND } from '../../core/walkscene.js';
import { GEAR, PARTY } from './data.js';

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
          L('Prendete. Non è molto, ma qui non c\'è altro da comprare che coraggio.'),
        ],
        () => {
          s.giveMoney(150);
          s.setMain(1);
        },
      );
    } else if (q.main === 1) D([L('Il faro è a est, oltre la brughiera. Seguite il sentiero di terra, e non fermatevi a guardare le pietre troppo a lungo.')]);
    else if (q.main === 2) {
      D(
        [
          L('Il faro... è di nuovo acceso! L\'ho visto dalla finestra. Avete il Sigillo della Luce.'),
          L('Ora le grotte. Marta, la figlia del vecchio pescatore, ci è scesa stamattina a cercare suo fratello Nilo. Dice che sente cantare, là sotto.'),
          L('Raggiungetela all\'ingresso delle grotte, sotto la scogliera a ovest. Insieme sarete più forti.'),
        ],
        () => s.setMain(3),
      );
    } else if (q.main <= 4) D([L('Le grotte sono a ovest, sotto la scogliera. Trovate Marta, e riportatemi quei due ragazzi.')]);
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
    } else D([L('Mio fratello Nilo dice che nelle grotte qualcuno canta. Io non ci credo. Ma se ci va, io vado a riprenderlo.')]);
    return;
  }
  if (id === 'nilo') {
    D([L('Mi avete tirato fuori da quel bozzolo... Laggiù, nel buio, la Madre cantava la stessa canzone che si sente vicino al silo.'), L('Credo che il dio sogni anche lei. Che sogni tutti noi.')]);
  }
}

export function gearName(id) {
  return GEAR[id]?.name || id;
}

export function memberName(id) {
  return PARTY[id]?.name || id;
}

export { FRIEND };
