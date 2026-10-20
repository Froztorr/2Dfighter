import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipmentScreen} from './equipment-ui.mjs';
import {newSave,ITEMS} from './core.mjs';

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
