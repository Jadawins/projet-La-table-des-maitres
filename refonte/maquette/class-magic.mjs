export function classMagic(state,c,level=state.level){
  const cls=c.classes.find(x=>x.id===state.classId),base=cls?.niveaux?.[0]||{};
  const sub=level>=3?c.subclasses.find(x=>x.id===state.subclassId&&x.classe_parente===state.classId):null;
  const supplement=c.remainingSupplements?.spellcasting?.[sub?.id]||c.fighterSupplements?.spellcasting?.[sub?.id];
  const values=(supplement?.rows||c.fighterSupplements?.spellcasting?.[supplement?.tableRef]?.rows)?.[level];
  const pact=cls?.niveaux?.[level]?.emplacements_pacte;
  const extra=values?{sorts_prepares:values[0],sorts_mineurs:level>=10&&supplement.cantripsFrom10?supplement.cantripsFrom10:supplement.cantrips,emplacements_de_sort:Object.fromEntries(values.slice(1).map((n,i)=>[i+1,n]).filter(([,n])=>n>0))}:pact?{emplacements_de_sort:{[pact.niveau]:pact.nombre}}:{};
  return {enabled:Boolean(base.incantation||sub?.incantation),ability:base.caracteristique_incantation||sub?.caracteristique_incantation||null,spellClass:base.incantation?state.classId:sub?.filtre_sorts_classe||state.classId,row:{...(cls?.niveaux?.[level]||{}),...extra},source:supplement?.source,note:supplement?.note};
}
