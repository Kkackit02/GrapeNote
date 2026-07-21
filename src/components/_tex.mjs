import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";

// skins.ts에서 스킨 데이터 추출
const src = readFileSync("src/lib/skins.ts","utf8");
const body = src.slice(src.indexOf("export const SKINS"), src.indexOf("];", src.indexOf("export const SKINS")));
const skins = [];
for (const m of body.matchAll(/\{\s*id: "([^"]+)",\s*name: "([^"]+)",\s*emoji: "([^"]+)",\s*colors: \[([^\]]+)\],\s*stroke: "([^"]+)",\s*gloss: "([^"]+)",([\s\S]*?)unlock:/g)) {
  const [,id,name,emoji,colors,stroke,gloss,rest] = m;
  const tex = /texture: "([a-z]+)"/.exec(rest)?.[1] ?? null;
  const texC = /textureColor: "([^"]+)"/.exec(rest)?.[1] ?? null;
  const eff = /effect: "([a-z]+)"/.exec(rest)?.[1] ?? null;
  skins.push({id,name,emoji,colors:colors.split(",").map(s=>s.trim().replace(/"/g,"")),stroke,gloss,texture:tex,textureColor:texC,effect:eff});
}
console.log("스킨", skins.length, "개");

function texSvg(sk){
  const c = sk.textureColor ?? sk.gloss;
  switch(sk.texture){
    case "stripe": return `<g opacity="0.3">${[-0.75,-0.25,0.25,0.75].map(x=>`<rect x="${x-0.1}" y="-1.4" width="0.2" height="2.8" fill="${c}" transform="rotate(20)"/>`).join("")}</g>`;
    case "speckle": return `<g opacity="0.5">${[[-0.4,-0.15,0.13],[0.3,0.35,0.1],[-0.05,0.55,0.08],[0.5,-0.4,0.09],[-0.55,0.4,0.07]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join("")}</g>`;
    case "facet": return `<g opacity="0.32"><polygon points="0,-0.9 0.55,-0.1 0,0.5 -0.55,-0.1" fill="${c}"/><polygon points="0,-0.9 -0.55,-0.1 -0.9,-0.45" fill="${c}" opacity="0.6"/><polygon points="0,0.5 0.55,-0.1 0.85,0.35" fill="${c}" opacity="0.5"/></g>`;
    case "metal": return `<g opacity="0.4"><rect x="-1.3" y="-0.42" width="2.6" height="0.3" fill="${c}" transform="rotate(-28)"/><rect x="-1.3" y="0.16" width="2.6" height="0.14" fill="${c}" opacity="0.7" transform="rotate(-28)"/></g>`;
    case "swirl": return `<g opacity="0.42" fill="none" stroke="${c}" stroke-linecap="round"><path d="M -0.75 0.2 C -0.3 -0.6, 0.35 -0.55, 0.6 0.05" stroke-width="0.16"/><path d="M -0.5 0.62 C -0.1 0.1, 0.45 0.3, 0.72 0.55" stroke-width="0.12" opacity="0.8"/></g>`;
    default: return "";
  }
}
function berry(sk){
  const R=46, C=60;
  const stops=sk.colors.map((c,i)=>`<stop offset="${(i/(sk.colors.length-1))*100}%" stop-color="${c}"/>`).join("");
  const halo = (sk.effect==="flame"||sk.effect==="glow")
    ? `<circle cx="${C}" cy="${C}" r="${R*1.22}" fill="${sk.colors[0]}" opacity="0.4"/>` : "";
  const spark = sk.effect==="sparkle"
    ? `<g transform="translate(${C+R*0.45} ${C-R*0.48}) scale(${R*0.34})"><path d="M 0 -1 Q 0.18 -0.18 1 0 Q 0.18 0.18 0 1 Q -0.18 0.18 -1 0 Q -0.18 -0.18 0 -1 Z" fill="#fff"/></g>
       <g transform="translate(${C-R*0.48} ${C+R*0.4}) scale(${R*0.24})"><path d="M 0 -1 Q 0.18 -0.18 1 0 Q 0.18 0.18 0 1 Q -0.18 0.18 -1 0 Q -0.18 -0.18 0 -1 Z" fill="#fff"/></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <defs><radialGradient id="g" cx="0.35" cy="0.3" r="0.9">${stops}</radialGradient>
  <clipPath id="cp"><circle cx="0" cy="0" r="1"/></clipPath></defs>
  <rect width="120" height="120" fill="#faf5ff"/>${halo}
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#g)" stroke="${sk.stroke}" stroke-width="2.5"/>
  <g transform="translate(${C} ${C}) scale(${R})" clip-path="url(#cp)">${texSvg(sk)}</g>
  <ellipse cx="${C-R*0.35}" cy="${C-R*0.4}" rx="${R*0.28}" ry="${R*0.18}" fill="${sk.gloss}" opacity="0.8"/>${spark}</svg>`;
}

const COLS=5, CW=150, CH=175;
const bufs=[];
for(const sk of skins) bufs.push({sk, buf: await sharp(Buffer.from(berry(sk))).png().toBuffer()});
const W=COLS*CW, H=Math.ceil(bufs.length/COLS)*CH;
const labels=bufs.map((b,i)=>{const col=i%COLS,row=Math.floor(i/COLS);
  return `<text x="${col*CW+CW/2}" y="${row*CH+CH-28}" font-size="17" font-family="sans-serif" text-anchor="middle" fill="#4c1d95">${b.sk.name}</text>
  <text x="${col*CW+CW/2}" y="${row*CH+CH-10}" font-size="13" font-family="sans-serif" text-anchor="middle" fill="#9ca3af">${b.sk.texture??"-"}${b.sk.effect?" +"+b.sk.effect:""}</text>`;}).join("");
const out=await sharp({create:{width:W,height:H,channels:4,background:"#ffffff"}})
  .composite([...bufs.map((b,i)=>({input:b.buf,left:(i%COLS)*CW+15,top:Math.floor(i/COLS)*CH+8})),
    {input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels}</svg>`),left:0,top:0}])
  .png().toBuffer();
writeFileSync("_tex.png",out);
console.log("렌더 완료");
