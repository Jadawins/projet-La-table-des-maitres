const fault=message=>Object.assign(new Error(message),{status:400});
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function validateInventory(raw){
  if(!Array.isArray(raw)||raw.length>100)throw fault('L’inventaire peut contenir jusqu’à 100 objets ajoutés.');
  const rows=raw.map(item=>{
    if(!item||!uuid(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>120||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>9999||typeof item.description!=='string'||item.description.length>2000)throw fault('Saisissez un nom (120 caractères maximum), une quantité entière de 1 à 9 999 et une description de 2 000 caractères maximum.');
    return {id:item.id,name:item.name.trim(),quantity:item.quantity,description:item.description.trim()};
  });
  if(new Set(rows.map(item=>item.id)).size!==rows.length)throw fault('Un objet figure deux fois dans l’inventaire.');
  if(new TextEncoder().encode(JSON.stringify(rows)).length>32768)throw fault('Les descriptions de votre inventaire sont trop longues. Abrégez-les avant d’enregistrer.');
  return rows;
}
export function changeInventory(raw,action){
  const rows=validateInventory(raw||[]);
  if(action?.type==='add')return validateInventory([...rows,action.item]);
  if(!uuid(action?.id)||!rows.some(item=>item.id===action.id))throw fault('Cet objet n’est plus dans l’inventaire. Actualisez la fiche.');
  if(action.type==='remove')return rows.filter(item=>item.id!==action.id);
  if(action.type==='update')return validateInventory(rows.map(item=>item.id===action.id?{...action.item,id:item.id}:item));
  throw fault('Modification d’inventaire invalide.');
}
