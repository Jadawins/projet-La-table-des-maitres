// Small synthetic directory in the inherited MongoDB format. No external service.
export function bestiaryFixtures(){return [
  {slug:'goblin',nom:'Gobelin',nom_original:'Goblin',taille:'P',type:'Humanoid',pv:7,ca:15,pv_formule:'2d6',fp:'1/4',fp_numerique:0.25,
    caracteristiques:{FOR:8,FOR_mod:-1,DEX:14,DEX_mod:2,CON:10,CON_mod:0,INT:10,INT_mod:0,SAG:8,SAG_mod:-1,CHA:8,CHA_mod:-1},
    vitesse:{marche:9},resistances:[],attaques:[{nom:'Cimeterre',bonus:4,degats:'1d6+2',type:'tranchant',portee:'1,5 m',desc:'Attaque de contrôle à résoudre manuellement.'}],
    traits:[{nom:'Échappatoire',description:'Trait de contrôle.'}],source:'fixture-only'},
  {slug:'giant-eagle',nom:'Aigle géant',nom_original:'Giant Eagle',taille:'G',type:'Beast',pv:26,ca:13,fp:'1',vitesse:{marche:3,vol:24},caracteristiques:{DEX:17,DEX_mod:3},attaques:[],source:'fixture-only'},
  {slug:'wolf',nom:'Loup',nom_original:'Wolf',taille:'M',type:'Beast',pv:11,ca:13,fp:'1/4',caracteristiques:{DEX:15,DEX_mod:2},vitesse:{marche:12},source:'fixture-only'}
];}
export function bestiaryMemory(rows=bestiaryFixtures()){
  return {rows,reads:0,find(){this.reads++;let limit=Infinity;return {limit(n){limit=n;return this;},async toArray(){return structuredClone(rows.slice(0,limit));}};}};
}
