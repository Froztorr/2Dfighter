import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipmentScreen} from './equipment-ui.mjs';
import {newSave,ITEMS,equip,loadSave,stats,strikeContacts} from './core.mjs';

test('equipment opens on the character overview with all ten slots',()=>{
 const html=equipmentScreen(newSave(),null,'visual',()=>'<img>');
 assert.equal((html.match(/data-slot=/g)||[]).length,10);
 assert.match(html,/id="heroPreview"/);
 assert.ok(!html.includes('equipmentGrid'));
 assert.ok(!html.includes('data-item='));
});
test('slot picker keeps the preview and shows compatible items with ownership enforced',()=>{
 const save=newSave(),html=equipmentScreen(save,'weapon','visual',()=>'<img>');
 assert.match(html,/id="heroPreview"/);assert.match(html,/equipmentGrid/);
 for(const [id,item]of Object.entries(ITEMS))if(item.slot==='weapon'){
  if(save.owned.includes(id))assert.match(html,new RegExp(`data-item="${id}"`));
  else assert.match(html,new RegExp(`disabled[^>]*data-locked="${id}"`));
 }
 assert.match(html,/data-gear-done/);assert.match(html,/data-unequip="weapon"/);
 assert.ok(!html.includes('data-item="wood-shield"'));
});
test('description shows actual equipped stats and two handed offhand cannot be selected',()=>{
 const save=newSave();save.equipment.weapon='greatsword';
 const overview=equipmentScreen(save,null,'visual',()=>'<img>');
 assert.match(overview,/data-slot="offhand"[^>]*disabled/);
 const detail=equipmentScreen(save,'weapon','description',()=>'<img>');
 assert.match(detail,/Dawn Greatsword/);assert.match(detail,/19/);assert.ok(!detail.includes('equipmentGrid'));
});

test('one-hand swords, maces and daggers equip in either hand and persist as a working pair',()=>{
 const save=newSave();save.owned.push('iron-sword','mace');
 for(const [main,off]of [['rust-sword','iron-sword'],['rust-sword','mace'],['mace','parry-dagger'],['parry-dagger','mace']]){
  assert.equal(equip(save,'weapon',main),true);assert.equal(equip(save,'offhand',off),true);
  const restored=loadSave(JSON.stringify(save));assert.equal(restored.equipment.weapon,main);assert.equal(restored.equipment.offhand,off);
  const hits=strikeContacts(restored);assert.equal(hits.length,2);assert.equal(hits[0].damage+hits[1].damage,stats(restored).attack);assert.equal(stats(restored).canBlock,false);
 }
 const picker=equipmentScreen(save,'offhand','visual',()=>'<img>');
 for(const id of ['rust-sword','iron-sword','mace','parry-dagger'])assert.ok(picker.includes(`data-item="${id}"`));
 assert.ok(!picker.includes('data-item="ember-staff"'));assert.equal(equip(save,'weapon','wood-shield'),false);
 equip(save,'weapon','ember-staff');assert.equal(save.equipment.offhand,null);assert.equal(equip(save,'offhand','mace'),false);
});
