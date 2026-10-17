// Hamara solver engine: preflop ranges (chart-based approximation) + equity (Monte Carlo)
(function(G){
const RANKS='AKQJT98765432';
const RV=r=>14-RANKS.indexOf(r); // A=14..2=2
function handName(i,j){const a=RANKS[i],b=RANKS[j];if(i===j)return a+b;return i<j?a+b+'s':b+a+'o'}
function combos(n){return n.length===2?6:n[2]==='s'?4:12}
// heuristic opening strength
function score(n){
  const h=RV(n[0]),l=RV(n[1]);
  if(h===l) return 53+(h-2)*3.5;
  const s=n[2]==='s',g=h-l-1;
  let v=h*2.4+l*1.7;
  if(s) v+=9;
  v-= g===0?0:g===1?1.2:g===2?3:g===3?5.5:7+(g-4)*0.5;
  if(h===14) v+= s?8:2;
  if(h===14&&l<=5&&s) v+=2;              // A5s-A2s wheel
  if(h===13&&s) v+=3.5;
  if(h===12&&s) v+=1;
  if(l>=10) v+=3.5;                      // broadway
  if(!s&&l<10) v-=6;                     // weak offsuit
  if(s&&g<=1&&l>=4&&h<=10) v+=2.5;       // suited connectors/gappers
  return v;
}
const ALL=[];for(let i=0;i<13;i++)for(let j=0;j<13;j++)ALL.push(handName(i,j));
const ORDER=[...ALL].sort((a,b)=>score(b)-score(a)||combos(a)-combos(b));
const RANK={};let cum=0;ORDER.forEach(n=>{cum+=combos(n);RANK[n]=cum/1326});
// top% of hands by cumulative combos
function inTop(n,pct){return RANK[n]<=pct/100+1e-9}

// positions for N players (dealer button style), first to act first
const POS_NAMES={2:['SB','BB'],3:['BTN','SB','BB'],4:['CO','BTN','SB','BB'],5:['HJ','CO','BTN','SB','BB'],6:['UTG','HJ','CO','BTN','SB','BB'],
 7:['UTG','LJ','HJ','CO','BTN','SB','BB'],8:['UTG','UTG+1','LJ','HJ','CO','BTN','SB','BB'],9:['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB'],10:['UTG','UTG+1','UTG+2','MP','LJ','HJ','CO','BTN','SB','BB']};
const HEB={UTG:'ראשון לדבר',LJ:'אמצע',HJ:'שניים לפני הדילר','UTG+1':'שני לדבר','UTG+2':'שלישי לדבר',MP:'אמצע',CO:'אחד לפני הדילר',BTN:'דילר',SB:'סמול בליינד',BB:'ביג בליינד'};
// open % by number of players still behind you
function openPct(pos,N){
  if(pos==='BB') return null;
  if(pos==='SB') return N===2?80:42;
  const behind=POS_NAMES[N].length-1-POS_NAMES[N].indexOf(pos);
  return ({2:46,3:28,4:21,5:17,6:14,7:12,8:10.5,9:9.5})[behind]||9;
}
// facing a raise: 3bet / call % of all hands, depending on raiser's open %
function vsRaise(pos,raiserPos,N){
  const op=openPct(raiserPos,N);
  const tb=Math.max(2.5,Math.min(13,op*0.32));       // 3bet range
  let call=op*(pos==='BB'?1.15:pos==='SB'?0.25:0.45); // flat range
  if(pos==='BTN') call*=1.2;
  return {threebet:tb,call:Math.min(call,45),op};
}
function advise(n,pos,N,raiserPos){
  if(!raiserPos){
    if(pos==='BB') return {act:'check',label:'צ׳ק',pct:null,why:'כולם קיפלו או רק השוו – אתה כבר בפנים.'};
    const p=openPct(pos,N);
    return inTop(n,p)?{act:'raise',label:'להעלות',size:'לגובה 2.2–2.5 ביג בליינד',pct:p}:{act:'fold',label:'לקפל',pct:p};
  }
  const v=vsRaise(pos,raiserPos,N);
  if(inTop(n,v.threebet)) return {act:'3bet',label:'3-bet',size:'להעלות שוב, פי 3 מההעלאה שלו',pct:v.threebet,v};
  if(inTop(n,v.threebet+v.call)) return {act:'call',label:'להשוות',pct:v.call,v};
  return {act:'fold',label:'לקפל',pct:v.threebet+v.call,v};
}
function rangeGrid(pos,N,raiserPos){
  const out={};ALL.forEach(n=>out[n]=advise(n,pos,N,raiserPos).act);return out;
}

// ---------- equity ----------
// cards 0..51: rank = c>>2 (0=2 .. 12=A), suit = c&3
function eval7(cs){
  const rc=new Array(13).fill(0),sc=[0,0,0,0],sm=[0,0,0,0];
  for(const c of cs){const r=c>>2,s=c&3;rc[r]++;sc[s]++;sm[s]|=1<<r}
  let fs=-1;for(let s=0;s<4;s++)if(sc[s]>=5)fs=s;
  const straightHi=m=>{for(let r=12;r>=3;r--){const need=r===3?(0x100F):(0x1F<<(r-4));if((m&need)===need)return r}return -1};
  if(fs>=0){const sf=straightHi(sm[fs]);if(sf>=0)return 8e6+sf}
  let quad=-1,trips=[],pairs=[],singles=[],mask=0;
  for(let r=12;r>=0;r--){if(rc[r])mask|=1<<r;if(rc[r]===4)quad=r;else if(rc[r]===3)trips.push(r);else if(rc[r]===2)pairs.push(r);else if(rc[r]===1)singles.push(r)}
  const k=(arr,n)=>{let v=0;for(let i=0;i<n;i++)v=v*13+(arr[i]??0);return v};
  if(quad>=0){const rest=[...trips,...pairs,...singles].sort((a,b)=>b-a);return 7e6+quad*13+rest[0]}
  if(trips.length&&(trips.length>1||pairs.length)){const p=trips.length>1?Math.max(trips[1],pairs[0]??-1):pairs[0];return 6e6+trips[0]*13+p}
  if(fs>=0){const f=[];for(let r=12;r>=0&&f.length<5;r--)if(sm[fs]&(1<<r))f.push(r);return 5e6+k(f,5)}
  const st=straightHi(mask);if(st>=0)return 4e6+st;
  if(trips.length){return 3e6+trips[0]*169+k(singles,2)}
  if(pairs.length>=2){const kick=[...pairs.slice(2),...singles].sort((a,b)=>b-a)[0];return 2e6+pairs[0]*169+pairs[1]*13+kick}
  if(pairs.length)return 1e6+pairs[0]*2197+k(singles,3);
  return k(singles,5);
}
const CAT=['קלף גבוה','זוג','שני זוגות','שלישייה','רצף','צבע','פול האוס','רביעייה','רצף צבע'];
function equity(hero,board,opps,iters){
  const used=new Set([...hero,...board]);const deck=[];for(let c=0;c<52;c++)if(!used.has(c))deck.push(c);
  let win=0,tie=0;const need=5-board.length;const cat=new Array(9).fill(0);
  for(let it=0;it<iters;it++){
    // partial Fisher-Yates
    const take=need+opps*2;
    for(let i=0;i<take;i++){const j=i+Math.floor(Math.random()*(deck.length-i));const t=deck[i];deck[i]=deck[j];deck[j]=t}
    const b=board.concat(deck.slice(0,need));
    const hv=eval7(hero.concat(b));cat[Math.floor(hv/1e6)]++;
    let best=0,cnt=0;
    for(let o=0;o<opps;o++){const v=eval7([deck[need+o*2],deck[need+o*2+1]].concat(b));if(v>best){best=v;cnt=1}else if(v===best)cnt++}
    if(hv>best)win++;else if(hv===best)tie+=1/(cnt+1);
  }
  return {win:win/iters,tie:tie/iters,eq:(win+tie)/iters,cat:cat.map(x=>x/iters)};
}
function cardFromStr(s){const r='23456789TJQKA'.indexOf(s[0]),su='shdc'.indexOf(s[1]);return r*4+su}
function cardsToHand(a,b){const ra=a>>2,rb=b>>2;const hi=Math.max(ra,rb),lo=Math.min(ra,rb);const R='23456789TJQKA';
  if(ra===rb)return R[hi]+R[lo];return R[hi]+R[lo]+((a&3)===(b&3)?'s':'o')}
G.HS={RANKS,ALL,ORDER,RANK,handName,combos,inTop,POS_NAMES,HEB,openPct,vsRaise,advise,rangeGrid,eval7,equity,CAT,cardFromStr,cardsToHand};
if(typeof module!=='undefined')module.exports=G.HS;
})(typeof window!=='undefined'?window:globalThis);
