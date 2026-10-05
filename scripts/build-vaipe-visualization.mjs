import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "dataset", "processed", "vaipe-text-finetuned", "all.json");
const outputDir = path.join(root, "dataset", "processed", "vaipe-visualization");
const output = path.join(outputDir, "index.html");
const records = JSON.parse(await fs.readFile(source, "utf8"));
const embedded = JSON.stringify(records).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>VAIPE OCR · Visualization</title>
  <style>
    :root{--bg:#0b1020;--panel:#121a2e;--panel2:#18233d;--line:#2a3859;--text:#edf3ff;--muted:#9eacc8;--accent:#70a7ff;--good:#38d39f;--warn:#ffc857;--bad:#ff6b81}
    *{box-sizing:border-box} body{margin:0;background:linear-gradient(135deg,#09101f,#111a31 55%,#0d1528);color:var(--text);font:14px/1.5 Inter,Segoe UI,Arial,sans-serif;min-height:100vh}
    .top{padding:28px 34px 22px;border-bottom:1px solid var(--line);background:rgba(8,13,28,.72);backdrop-filter:blur(12px);position:sticky;top:0;z-index:5}
    .brand{display:flex;align-items:center;justify-content:space-between;gap:20px}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.title{font-size:28px;font-weight:750;margin:4px 0}.sub{color:var(--muted);margin:0}
    .stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 15px;min-width:120px}.stat b{display:block;font-size:20px}.stat span{color:var(--muted);font-size:12px}
    .layout{display:grid;grid-template-columns:285px minmax(0,1fr) 365px;gap:16px;padding:18px;max-width:1800px;margin:auto}.card{background:rgba(18,26,46,.9);border:1px solid var(--line);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.18)}
    .side{padding:16px;height:calc(100vh - 225px);min-height:500px;position:sticky;top:205px;display:flex;flex-direction:column}.search{width:100%;background:#0c1427;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:11px 12px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px #70a7ff22}.hint{color:var(--muted);font-size:12px;margin:8px 1px 14px}.list{overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:3px}.item{border:1px solid transparent;border-radius:10px;padding:9px 10px;cursor:pointer;color:#cbd7ef}.item:hover{background:var(--panel2)}.item.active{background:#20345b;border-color:#4169a3;color:white}.item small{display:block;color:var(--muted);font-size:11px;margin-top:2px}
    .viewer{padding:16px;min-width:0}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.toolbar h2{font-size:16px;margin:0}.buttons{display:flex;gap:7px}.btn{border:1px solid var(--line);background:#1a2948;color:var(--text);border-radius:9px;padding:8px 11px;cursor:pointer}.btn:hover{border-color:var(--accent);background:#223a64}.btn:disabled{opacity:.4;cursor:not-allowed}.canvas-wrap{background:#070b15;border:1px solid var(--line);border-radius:12px;min-height:480px;display:flex;align-items:center;justify-content:center;overflow:auto;padding:12px}.canvas-wrap canvas{display:block;max-width:100%;height:auto;box-shadow:0 8px 30px #0008}.legend{display:flex;gap:14px;color:var(--muted);font-size:12px;margin:10px 2px 0}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.green{background:var(--good)}.yellow{background:var(--warn)}.red{background:var(--bad)}
    .details{padding:16px;height:calc(100vh - 225px);min-height:500px;position:sticky;top:205px;overflow:auto}.details h2{font-size:16px;margin:0 0 2px}.path{color:var(--muted);font-size:11px;word-break:break-all;margin-bottom:15px}.confidence{height:8px;background:#273551;border-radius:99px;overflow:hidden;margin:7px 0 14px}.confidence i{display:block;height:100%;background:linear-gradient(90deg,var(--bad),var(--warn),var(--good));border-radius:99px}.line{padding:10px 0;border-bottom:1px solid #24314d}.line:last-child{border-bottom:0}.line-head{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:11px}.line-text{font-size:14px;color:#f5f8ff;margin-top:3px}.line.low .line-text{color:#ffd8de}.empty{color:var(--muted);text-align:center;padding:45px 10px}.footer{color:var(--muted);font-size:11px;padding:0 18px 22px;text-align:center}
    @media(max-width:1150px){.layout{grid-template-columns:240px minmax(0,1fr)}.details{grid-column:1/-1;position:static;height:auto}.side{top:155px;height:calc(100vh - 175px)}.top{position:static}}@media(max-width:720px){.layout{display:block;padding:10px}.side,.details{position:static;height:auto;margin-bottom:10px}.side{min-height:300px}.canvas-wrap{min-height:300px}.top{padding:20px}.title{font-size:22px}}
  </style>
</head>
<body>
  <header class="top"><div class="brand"><div><div class="eyebrow">VAIPE · OCR REVIEW</div><div class="title">Prescription text visualization</div><p class="sub">Kiểm tra ảnh, vị trí nhận diện, nội dung text và độ tin cậy trong cùng một màn hình.</p></div><div class="eyebrow">Fine-tuned PP-OCRv5</div></div><div class="stats"><div class="stat"><b id="nImages">—</b><span>ảnh đã xử lý</span></div><div class="stat"><b id="nLines">—</b><span>dòng OCR</span></div><div class="stat"><b id="nWords">—</b><span>từ OCR</span></div><div class="stat"><b id="avgConf">—</b><span>confidence trung bình</span></div></div></header>
  <main class="layout">
    <aside class="card side"><input id="search" class="search" placeholder="Tìm mã ảnh, ví dụ 867..." /><div class="hint"><span id="shown">—</span> ảnh hiển thị · Enter chọn kết quả đầu tiên</div><div id="list" class="list"></div></aside>
    <section class="card viewer"><div class="toolbar"><h2 id="sampleTitle">—</h2><div class="buttons"><button class="btn" id="prev">← Trước</button><button class="btn" id="next">Sau →</button></div></div><div class="canvas-wrap"><canvas id="canvas"></canvas><div id="empty" class="empty" hidden>Không tìm thấy ảnh</div></div><div class="legend"><span><i class="dot green"></i>≥ 90%</span><span><i class="dot yellow"></i>70–90%</span><span><i class="dot red"></i>&lt; 70%</span><span>Click vào khung để xem text</span></div></section>
    <aside class="card details"><h2>Thông tin nhận diện</h2><div id="path" class="path">—</div><div class="line-head"><span>Confidence trung bình</span><b id="sampleConf">—</b></div><div class="confidence"><i id="confBar" style="width:0"></i></div><div id="lines"></div></aside>
  </main><div class="footer">Dữ liệu nguồn: dataset/processed/vaipe-text-finetuned/all.json · Click bounding box để xem chi tiết</div>
  <script id="data" type="application/json">${embedded}</script>
  <script>
    const data=JSON.parse(document.getElementById('data').textContent);let filtered=data.slice(),index=0,selected=-1;
    const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),img=new Image();
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const words=r=>r.lines.flatMap(x=>x.words||[]); const conf=r=>{const a=words(r).map(x=>Number(x.confidence)).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0};
    const relImage=r=>\`../../external/vaipe-p/public_train/image/\${r.sample_id}.png\`;
    function stats(){let w=data.flatMap(words),a=w.map(x=>Number(x.confidence)).filter(Number.isFinite);$('nImages').textContent=data.length.toLocaleString();$('nLines').textContent=data.reduce((n,r)=>n+r.lines.length,0).toLocaleString();$('nWords').textContent=w.length.toLocaleString();$('avgConf').textContent=(a.reduce((x,y)=>x+y,0)/a.length*100).toFixed(1)+'%'}
    function renderList(){const q=$('search').value.toLowerCase();filtered=data.filter(r=>r.sample_id.toLowerCase().includes(q));$('shown').textContent=filtered.length; $('list').innerHTML=filtered.slice(0,300).map((r,i)=>\`<div class="item \${i===index?'active':''}" data-i="\${i}"><b>\${esc(r.sample_id)}</b><small>\${r.lines.length} dòng · \${(conf(r)*100).toFixed(0)}%</small></div>\`).join('')||'<div class="empty">Không tìm thấy</div>';[...$('list').children].forEach(el=>el.onclick=()=>{index=Number(el.dataset.i);selected=-1;renderList();render()})}
    function draw(){const r=filtered[index];if(!r){$('empty').hidden=false;canvas.hidden=true;return}$('empty').hidden=true;canvas.hidden=false;const src=relImage(r);img.onload=()=>{const scale=Math.min(1,760/img.width);canvas.width=img.width*scale;canvas.height=img.height*scale;ctx.drawImage(img,0,0,canvas.width,canvas.height);r.lines.forEach((line,li)=>{const c=conf({lines:[line]});ctx.strokeStyle=c>=.9?'#38d39f':c>=.7?'#ffc857':'#ff6b81';ctx.lineWidth=selected===li?4:2;const [x1,y1,x2,y2]=line.bbox;ctx.strokeRect(x1*scale,y1*scale,(x2-x1)*scale,(y2-y1)*scale);if(selected===li){ctx.fillStyle='#70a7ff';ctx.font='bold 13px Segoe UI';ctx.fillText((li+1)+': '+line.text.slice(0,42),x1*scale,Math.max(14,y1*scale-5))}})};img.onerror=()=>{$('empty').textContent='Không mở được ảnh: '+src;$('empty').hidden=false};img.src=src}
    function render(){const r=filtered[index];if(!r){$('sampleTitle').textContent='—';$('lines').innerHTML='';draw();return}$('sampleTitle').textContent=r.sample_id;$('path').textContent=r.image;$('sampleConf').textContent=(conf(r)*100).toFixed(1)+'%';$('confBar').style.width=(conf(r)*100)+'%';$('lines').innerHTML=r.lines.map((l,i)=>{const c=conf({lines:[l]});return \`<div class="line \${c<.7?'low':''}" data-line="\${i}"><div class="line-head"><span>Dòng \${i+1} · bbox \${l.bbox.map(v=>Math.round(v)).join(', ')}</span><b>\${(c*100).toFixed(1)}%</b></div><div class="line-text">\${esc(l.text)}</div></div>\`}).join('');[...$('lines').children].forEach(el=>el.onclick=()=>{selected=Number(el.dataset.line);render()});$('prev').disabled=index<=0;$('next').disabled=index>=filtered.length-1;draw()}
    $('search').oninput=()=>{index=0;selected=-1;renderList();render()};$('search').onkeydown=e=>{if(e.key==='Enter'&&filtered.length){index=0;render()}};$('prev').onclick=()=>{if(index>0){index--;selected=-1;renderList();render()}};$('next').onclick=()=>{if(index<filtered.length-1){index++;selected=-1;renderList();render()}};document.addEventListener('keydown',e=>{if(e.target.id==='search')return;if(e.key==='ArrowLeft')$('prev').click();if(e.key==='ArrowRight')$('next').click()});stats();renderList();render();
  </script>
</body></html>`;

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(output, html, "utf8");
console.log(`Wrote ${output} for ${records.length} images`);
