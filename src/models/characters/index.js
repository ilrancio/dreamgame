// I personaggi di Quaternius (CC0), versione low-poly (i file "Smooth" sono
// più pesanti e non servono). Testo OBJ incorporato nel gioco.
import casual from './Male_Casual.obj?raw';
import longsleeve from './Male_LongSleeve.obj?raw';
import shirt from './Male_Shirt.obj?raw';
import suit from './Male_Suit.obj?raw';
import fCasual from './Female_Casual.obj?raw';
import fAlternative from './Female_Alternative.obj?raw';
import fTankTop from './Female_TankTop.obj?raw';
import fDress from './Female_Dress.obj?raw';

export const CHARACTER_MODELS = {
  casual,
  longsleeve,
  shirt,
  suit,
  f_casual: fCasual,
  f_alternative: fAlternative,
  f_tanktop: fTankTop,
  f_dress: fDress,
};

// la versione femminile di ogni modello maschile (stesso stile di vestiti)
export const FEMININE = { casual: 'f_casual', longsleeve: 'f_alternative', shirt: 'f_tanktop', suit: 'f_dress' };
