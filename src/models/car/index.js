// Le auto del Car Kit di Kenney (CC0). Le ruote sono pezzi separati: girano e sterzano.
// Solo quelli elencati qui finiscono nel gioco pubblicato.
import sedan_sports from './sedan-sports.glb?url';
import sedan from './sedan.glb?url';
import suv from './suv.glb?url';
import van from './van.glb?url';
import taxi from './taxi.glb?url';
import hatchback_sports from './hatchback-sports.glb?url';
import colormap from './Textures/colormap.png?url';

export const CAR_MODELS = {
  'sedan-sports': sedan_sports,
  sedan: sedan,
  suv: suv,
  van: van,
  taxi: taxi,
  'hatchback-sports': hatchback_sports,
};
export const CAR_MODELS_TEXTURE = colormap;
