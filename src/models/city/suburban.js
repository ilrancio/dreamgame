// Le case del City Kit Suburban di Kenney (CC0): il villaggio dell'Isola e i vicoli di Sant'Onirio.
// Solo quelli elencati qui finiscono nel gioco pubblicato.
import building_type_a from './suburban/building-type-a.glb?url';
import building_type_c from './suburban/building-type-c.glb?url';
import building_type_d from './suburban/building-type-d.glb?url';
import building_type_e from './suburban/building-type-e.glb?url';
import building_type_g from './suburban/building-type-g.glb?url';
import building_type_o from './suburban/building-type-o.glb?url';
import fence from './suburban/fence.glb?url';
import planter from './suburban/planter.glb?url';
import tree_large from './suburban/tree-large.glb?url';
import colormap from './suburban/Textures/colormap.png?url';

export const SUBURBAN_MODELS = {
  'building-type-a': building_type_a,
  'building-type-c': building_type_c,
  'building-type-d': building_type_d,
  'building-type-e': building_type_e,
  'building-type-g': building_type_g,
  'building-type-o': building_type_o,
  'fence': fence,
  'planter': planter,
  'tree-large': tree_large,
};
export const SUBURBAN_MODELS_TEXTURE = colormap;
