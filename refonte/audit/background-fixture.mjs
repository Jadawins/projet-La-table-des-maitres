import {backgroundFeat,grantInitial,grantOptions} from '../maquette/origin-rules.mjs';

// Test setup only: UI journeys must still choose these grants explicitly.
export function fillBackgroundFixture(state,c){
  const grant=backgroundFeat(state,c);
  if(grant?.feat?.id==='doue'){
    state.originGrants||={};
    state.originGrants.background={...grantInitial(),proficiencies:grantOptions(state,c,grant).filter(o=>o.type==='tool').slice(0,3).map(o=>o.id)};
  }
  return state;
}
