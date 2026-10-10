# Emberblade — 2Dfighter

เกม mobile portrait RPG แบบ pixel art ใช้ Phaser 3.90 สำหรับ game loop, Scene, sprite, Container และ tween ของอนิเมชั่น ตัว Phaser อยู่ใน vendor/ จึงไม่ต้องโหลด runtime จาก CDN

## เล่นบนคอมพิวเตอร์

ใช้ Node.js 20+ แล้วรัน `npm start` จากโฟลเดอร์นี้ เปิด http://127.0.0.1:4173

## เล่นบนมือถือ

รัน `npm start -- --lan` แล้วเปิด `http://<IP ของคอมใน Wi-Fi>:4173` บนมือถือในเครือข่ายเดียวกัน (เครื่องต้องอนุญาต inbound port 4173) หยุด server ด้วย Ctrl+C สามารถนำ index.html, style.css, app.js, core.mjs, fps-player.mjs, phaser-renderer.mjs และโฟลเดอร์ assets กับ vendor ไปวางบน static hosting ได้โดยตรง

## Main menu and combat feel

เริ่มที่โถงหลัก → เลือกด่าน → ออกเดินทาง แผนที่แสดงด่านที่ล็อก/ปลดล็อก ดาวสูงสุด และของดรอป พร้อม EXP/ความคืบหน้ารวม หน้าตัวละครจัดเป็น folio ธีมหินและทองเหลืองพร้อมแท่นตัวละคร เข้าคลังอาวุธ/ภารกิจ/แคมป์ได้จากโถง กลับโถงระหว่างสู้จะยุติรอบปัจจุบัน โดยของที่ได้รับแล้วไม่หาย

ฉากต่อสู้เป็น first person เห็นมือและอาวุธที่ถือ ใช้ 2D joint rig วาดแขน ข้อมือ ถุงมือ และอาวุธติดจุดจับเดียวกัน ไม่ตัดเฟรมจาก sprite sheet ผู้เล่น การฟันมีง้าง–ปะทะ–คืนท่า 4 ทิศ ดาเมจเกิดที่ 110 ms; parry ตอบสนองทันที มี hitstop, enemy recoil และเอฟเฟกต์ตามทิศ ปิด camera shake และ idle bob ตาม prefers-reduced-motion

## Controls

- ลากกลางจอเพื่อเริ่มฟันทันทีเมื่อผ่านระยะ 18 logical pixels ซ้าย/ขวา/ขึ้น/ลง; desktop ใช้ arrow keys
- ศัตรูแสดงลูกศรก่อนโจมตี: ฟันสวนทิศลูกศรในช่วง 450 ms สุดท้ายเพื่อ parry; 170 ms สุดท้ายเป็น perfect และ stun 2.1 วินาที
- Dodge ด้วยปุ่มลูกศรด้านล่างขวา หรือ Shift+arrow; หลบตามทิศลูกศรศัตรู ใช้ timing เดียวกับ parry มี cooldown 650 ms
- ท่าปกติมีลูกศรสำหรับ parry/dodge/block; ท่าโล่ heavy และกะโหลก sweep ต้อง BLOCK เท่านั้น ไม่มีลูกศร และมีออร่าแดงเต้นรอบศัตรู
- ศัตรูตั้งรับลดดาเมจ 84% ที่ LV1 เพิ่ม 4% ต่อเลเวลจนถึง 100%; parry/dodge เปิดช่องสวน 600–1095 ms ตามเลเวล, perfect เปิด 2.1 วินาที, บล็อกด้วยโล่เปิด 550 ms และ ward เปิด 900 ms
- กดปุ่มโล่ด้านล่างซ้ายค้าง หรือกด Space ค้าง เพื่อบล็อกทุกทิศ/ทุกประเภท เสีย stamina 24/42/34 ตามประเภท; ถ้าเหลือไม่พอหรือเหลือ 0 จะเสียเลือดและสตั้น 1.4 วินาที โจมตี/หลบ/ร่ายเวท/บล็อกไม่ได้ระหว่างสตั้น
- Stamina สูงสุด 100 ฟื้น 16 ต่อวินาทีเมื่อปล่อยโล่ หรือ 4 เมื่อถือโล่ เริ่มฟื้น 0.8 วินาทีหลังรับแรงปะทะ กำลังบล็อกจะฟันหรือร่ายเวทไม่ได้
- เปิดอุปกรณ์จากปุ่มดาบหรือเมนู เปลี่ยน WEAPON เป็น Ember Staff (แจกไว้ให้ลอง): ○ วงกลม = ไฟ, □ สี่เหลี่ยม = ward กัน 2 ครั้ง, ◎ ก้นหอย = nova; cooldown แยก 1.8/6.5/4.5 วินาที
- มี 6 ด่าน ด่านละ 3 ห้อง รวมบอส; ทุกตัวให้ EXP/ทอง/ของดรอป พร้อม floating tab 2.8 วินาที ของซ้ำเปลี่ยนเป็น 30 gold จบด่านได้โบนัสทองและสรุปรวม
- ดาวจบด่าน: 3 ดาว = ไม่เสีย HP และไม่ใช้ยา; 2 ดาว = เสีย HP รวมไม่เกินครึ่งของ HP สูงสุดตอนเข้าด่าน และใช้ยาไม่เกิน 1; นอกนั้น 1 ดาว การฮีลไม่ลบดาเมจที่สะสม
- ยาเริ่ม 3 ขวด ฟื้น 50 HP ซื้อเพิ่มที่ Forge ขวดละ 40 gold; ไม่กินยาตอนเลือดเต็ม
- อุปกรณ์ 10 ช่อง: หมวก เกราะ กางเกง รองเท้า อาวุธหลัก อาวุธรอง แหวน 2 สร้อย ผ้าคลุม รวมของ 47 ชิ้น; กดช่องแล้วเลือกจาก inventory เพื่อสวม/ถอด
- Greatsword และ staff/wand เป็นสองมือ ล็อกและถอดอาวุธรอง; ต้องมีโล่จึงบล็อกได้ สายมีดคู่ใช้ parry/dodge ส่วนเมจมี ward ไว้รับท่าที่หลบไม่ได้
- มือและอาวุธในฉากต่อสู้เปลี่ยนตามอุปกรณ์ หน้าสวมอุปกรณ์ใช้ภาพเต็มตัวใหม่ พร้อมหมวก เกราะ กางเกง รองเท้า ผ้าคลุม อาวุธ และเครื่องประดับ
- Forge ซื้อของ, Vigor/Edge เพิ่ม stat, replay ด่านที่ปลดล็อกได้; เซฟเก่าจะย้ายแหวนเดิมไปช่องแรกโดยรักษาอุปกรณ์และทองเดิม
- บันทึกทอง/อุปกรณ์/upgrade/ด่านที่ปลดล็อกใน localStorage (`emberblade-v1`) ไม่บันทึก combat กลางห้อง เปิดเมนูหรือสลับแท็บจะ pause

## Phaser first-person rig animation

`player-rig.mjs` samples continuous wrist poses and draws jointed forearms, cuffs, palms and fingers onto a native 240 × 400 pixel Phaser texture. Hard pixel silhouettes, 5-bit color channels, stepped lighting, blade bevels, segmented gauntlets and shaded wood/metal surfaces give the equipment a 16-bit look with dimensional shading. All 13 main weapons and seven offhands have explicit geometry; fingers render over the handle. Two-handed grips share the same weapon transform, so the support hand cannot drift away. Shields show their inner surface, straps and handle. Armor selects cloth, plate, leather or mage gloves and sleeves; there is no separate glove inventory slot. Four slash paths have contact at 110 ms, matching gameplay damage. Guard, recoil, parry, dodge, spells, stun, victory and death use the same rig. The old `fps-*.png` atlases are retained as source art but are not loaded for combat. The equipment portrait and enemy artwork remain unchanged.

แถวเฟรมคือ idle, ฟันขวา, ฟันซ้าย, ฟันขึ้น, ฟันลง, guard/block, parry/cast และ hurt/death การหลบใช้เฟรมลดมือหลบ การสตั้นค้างสลับเฟรมเสียหลัก การตายลดอาวุธและจอมืดก่อนเปิดผลแพ้ ชุดสีพิเศษเปลี่ยนสีวัสดุบน atlas โดยคง alpha และตำแหน่งมือ/ด้ามเดิม หมวกและรองเท้าดูได้ในหน้าสวมอุปกรณ์เพราะมุมมองต่อสู้ไม่เห็นส่วนเหล่านี้

หน้าสวมอุปกรณ์ใช้ Phaser Scene และ `portrait.png` ภาพเต็มตัวใหม่สี่รูปลักษณ์ สัดส่วนรักษาตามภาพต้นฉบับและแสดงของแต่ละช่องที่สวม

## Verification

`npm test` ตรวจจังหวะปะทะ เฟรมแต่ละ action อุปกรณ์ ทิศป้องกัน และ game loop ทั้ง 6 ด่าน รวม stun, cooldown, ward, pause, retry และ daily rollover

`npm ci && npm run test:browser` ตรวจ Chromium จริง (กำหนด `CHROMIUM_PATH` ได้; default `/usr/bin/chromium`) ตรวจ native frames สำหรับ 78 คู่ชุด/อาวุธ ทุก action, อาวุธรอง 7 แบบ, preview เต็มตัว, block-only cue ที่ซ่อนลูกศรและออร่าแดงเต้น, ท่าตายก่อนเปิดผล และจอมือถือ เก็บภาพใน `artifacts/` ใช้ `python tools/check-assets.py` ตรวจ RGBA และเฟรมไม่ว่าง

## Campaign expansion / daily / camp

- Frostbound Keep: Rime Revenant ถือ ice halberd; ฉากหิมะ/แท่งน้ำแข็ง; ดรอปหมวก โล่ และดาบน้ำแข็ง
- The Silken Abyss: Widow Matriarch ฟันด้วยกรงเล็บ 4 ทิศ; ฉากใยแมงมุม; ดรอปผ้าคลุมและอาวุธมีดคู่
- Obsidian Inferno: Obsidian Behemoth ถือขวานไฟ เน้น heavy และ block-only; ฉากรอยแยกลาวา; ดรอปแหวน เสื้อเมจ และขวานสองมือ
- ศัตรูใหม่แต่ละตัวมี 24 เฟรม รวม guard ready/impact; รวมศัตรู 7 แบบ และบันทึกดาวสูงสุดของแต่ละด่าน
- DAILY: กำจัด 6 ตัว, ป้องกันสำเร็จ 8 ครั้ง, จบด่าน 1 ครั้ง, เล่น minigame จบ 2 รอบ รับทอง/EXP/ยาได้เควสต์ละ 1 ครั้งต่อวัน รีเซ็ตเที่ยงคืน Asia/Bangkok
- CAMP / Ember Forge: หยุดเข็ม 5 ครั้ง รวม 15 คะแนน รับทอง `20 + 5 × คะแนน`, EXP `10 + 2 × คะแนน`; เต็มได้ยาอีก 1
- CAMP / Rune Memory: จำรูน 6 ตัวแล้วแตะตามลำดับ ผิดจบรอบ ได้ทอง `20 + 10 × จำนวนถูก`, EXP `10 + 2 × จำนวนถูก`; ถูกครบได้ยา 1
- แต่ละ minigame จ่ายรางวัล 3 รอบต่อวัน จากนั้นเป็น practice; ออกกลางรอบหรือสลับแท็บเบราว์เซอร์จะยกเลิกรอบ ไม่เสียสิทธิ์ ไม่ได้รางวัล
- Daily progress, claimed rewards, minigame counts และดาวบันทึกในเซฟเดิม เป็น offline sample ใช้นาฬิกาเครื่อง ไม่ใช่ระบบแข่งขันออนไลน์

ตรวจ UI ที่ viewport 390×844: parry/dodge และสวนผ่าน keyboard จริง, ตีเหล็ก 5 ครั้งและรับทอง, จำรูนถูก 6/6, รับ Camp Artisan และรีโหลดแล้วยัง CLAIMED/ทองคงอยู่ ไม่พบ console error ในเส้นทางนี้

ศัตรู 4 แบบใช้ sprite sheet RGBA แบบละ 20 เฟรม: ยืน 2, โดนตี, ตาย และ 4 ทิศ × (เตรียม 2, โจมตี, follow-through) สร้างด้วย built-in ImageGen จากภาพอ้างอิงของผู้ใช้ ดู prompt และการจัดเฟรมใน assets/README.md

เพิ่ม guard ready/impact 2 เฟรมต่อศัตรู, equipment atlas 36 ไอคอน (รวม potion), player atlas front/back 4 ชุด ตรวจ RGBA/ช่องภาพด้วย `python tools/check-assets.py` (ต้องมี Pillow)

นี่เป็น single-player sample ใช้ geometric gesture recognition สำหรับ 3 รูน ความสมดุลและ gesture ยังต้องทดสอบกับนิ้วบนมือถือจริง; ไม่มี account หรือ cloud save

ท่าผู้เล่นแยก idle, ฟันสี่ทิศ, guard, รับแรง block, parry, dodge, hurt, stun, death, cast, ward, heal, victory และ walk โดยท่าตายเริ่มทรุดแล้วล้มรอบจุดเท้า ส่วน stun ค้างจนหมดเวลาสถานะ ไม่รีเซ็ตเองเป็น idle
