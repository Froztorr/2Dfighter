export const APPEARANCE={
 face:{
  'man-classic':{label:'ชาย · คลาสสิก',width:.89,jaw:.76,eye:.037,brow:-.13},
  'man-angular':{label:'ชาย · คมเข้ม',width:.92,jaw:.91,eye:.039,brow:-.22},
  'man-soft':{label:'ชาย · อ่อนโยน',width:.91,jaw:.70,eye:.038,brow:0},
  'woman-classic':{label:'หญิง · คลาสสิก',width:.83,jaw:.61,eye:.036,brow:-.10},
  'woman-angular':{label:'หญิง · คมเข้ม',width:.85,jaw:.68,eye:.037,brow:-.20},
  'woman-soft':{label:'หญิง · อ่อนโยน',width:.88,jaw:.58,eye:.038,brow:.06}
 },
 skin:{fair:{label:'ผิวขาว',color:0xe6bfa0},warm:{label:'ผิวอุ่น',color:0xd7a17b},tan:{label:'ผิวแทน',color:0xb98c6c},olive:{label:'ผิวมะกอก',color:0xa98760},brown:{label:'ผิวน้ำตาล',color:0x87583f},deep:{label:'ผิวเข้ม',color:0x56392f}},
 hair:{crop:{label:'สั้นครอป'},swept:{label:'สั้นปัดข้าง'},spikes:{label:'สั้นตั้ง'},bob:{label:'บ๊อบ'},long:{label:'ยาวแสกกลาง'},ponytail:{label:'หางม้า'},braid:{label:'เปีย'},bun:{label:'มวยสูง'}},
 hairColor:{brown:{label:'น้ำตาล',color:0x39291f},black:{label:'ดำ',color:0x181923},chestnut:{label:'น้ำตาลแดง',color:0x753c27},blond:{label:'บลอนด์',color:0xc6a45c},silver:{label:'เงิน',color:0xb6bdca},auburn:{label:'แดงทอง',color:0xa54b2b}}
};
const defaults={face:'man-classic',skin:'tan',hair:'crop',hairColor:'brown'};
export function cleanAppearance(value){
 return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,typeof value?.[key]==='string'&&Object.hasOwn(APPEARANCE[key],value[key])?value[key]:fallback]));
}
