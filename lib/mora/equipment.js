/** Shared equipment vocabulary: questions are attached to the actual fixture, not its broad category. */
export { equipmentLabels, equipmentCategories } from '../../assets/mora-data.js';
export const equipmentWords = {
  socket:['steckdose', 'steckdosen'], light:['lampe', 'licht', 'leuchte', 'beleuchtung'], switch:['lichtschalter', 'schalter'],
  power:['strom', 'sicherung', 'stromversorgung'], heater:['heizung', 'heizkorper', 'heizkoerper', 'heizig', 'radiator'],
  key:['schlussel', 'schluessel', 'ausgesperrt'], washer:['waschmaschine'], dryer:['trockner'], dishwasher:['geschirrspuler'],
  tap:['wasserhahn', 'hahn'], drain:['abfluss', 'siphon'], pipe:['rohrbruch', 'rorbruch', 'rohr'],
  leak:['wasser', 'tropft', 'tropfts', 'leck', 'feuchtigkeit', 'schimmel'], noise:['nachbar', 'larm', 'laerm', 'ruhestorung'],
};
// Generic problem labels do not identify a particular physical device yet.
export function isSpecificEquipment(value) {
  return typeof value==='string' && !['unknown','leak','power'].includes(value);
}
