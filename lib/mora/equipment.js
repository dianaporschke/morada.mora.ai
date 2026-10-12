/** Shared equipment vocabulary: questions are attached to the actual fixture, not its broad category. */
export const equipmentLabels = {
  socket:'Steckdose', light:'Lampe / Leuchte', switch:'Lichtschalter', power:'Stromversorgung', heater:'Heizkörper',
  key:'Schlüssel / Zugang', washer:'Waschmaschine', dryer:'Trockner', dishwasher:'Geschirrspüler',
  tap:'Wasserhahn', drain:'Abfluss', pipe:'Rohr / Leitung', leak:'Wasseraustritt', noise:'Lärmstörung', unknown:'Noch unklar',
};
export const equipmentCategories = {
  socket:'electricity', light:'electricity', switch:'electricity', power:'electricity', heater:'heating', key:'access',
  washer:'appliances', dryer:'appliances', dishwasher:'appliances', tap:'water', drain:'water', pipe:'water', leak:'water', noise:'neighbours',
};
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
