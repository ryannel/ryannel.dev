/** Rounded, storybook miniatures with gentle, event-driven motion. */
export function scenery(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean, time: number) {
  const land = dark ? '#344c45' : '#e3edcc';
  const water = ctx.createLinearGradient(0,70,w,h);
  water.addColorStop(0,dark?'#224452':'#b5dedd');
  water.addColorStop(.55,dark?'#2b5660':'#ccebe4');
  water.addColorStop(1,dark?'#244753':'#b5dddf');
  ctx.fillStyle=water;ctx.fillRect(0,70,w,h-70);
  const left=new Path2D();
  left.moveTo(0,70);left.lineTo(w*.23,70);
  left.bezierCurveTo(w*.25,h*.19,w*.30,h*.22,w*.27,h*.29);
  left.bezierCurveTo(w*.23,h*.34,w*.22,h*.38,w*.26,h*.45);
  left.bezierCurveTo(w*.30,h*.53,w*.20,h*.57,w*.23,h*.66);
  left.bezierCurveTo(w*.29,h*.74,w*.27,h*.81,w*.24,h*.89);
  left.bezierCurveTo(w*.20,h*.94,w*.24,h*.98,w*.22,h);
  left.lineTo(0,h);left.closePath();
  const right=new Path2D();
  right.moveTo(w,70);right.lineTo(w*.75,70);
  right.bezierCurveTo(w*.68,h*.17,w*.66,h*.20,w*.68,h*.27);
  right.bezierCurveTo(w*.71,h*.32,w*.63,h*.35,w*.62,h*.43);
  right.bezierCurveTo(w*.59,h*.50,w*.64,h*.54,w*.61,h*.60);
  right.bezierCurveTo(w*.56,h*.65,w*.58,h*.74,w*.55,h*.80);
  right.bezierCurveTo(w*.52,h*.88,w*.54,h*.95,w*.52,h);
  right.lineTo(w,h);right.closePath();
  ctx.save();ctx.beginPath();ctx.rect(0,70,w,h-70);ctx.clip();
  for(const path of [left,right]) {
    ctx.strokeStyle=dark?'#396061':'#aed0c7';ctx.lineWidth=18;ctx.stroke(path);
    ctx.strokeStyle=dark?'#70755b':'#d8d3ac';ctx.lineWidth=7;ctx.stroke(path);
    const terrain=ctx.createLinearGradient(0,70,0,h);
    terrain.addColorStop(0,dark?'#405a4b':'#edf1d7');terrain.addColorStop(1,land);
    ctx.fillStyle=terrain;ctx.fill(path);
    ctx.save();ctx.clip(path);
    // Quiet, deterministic flecks give the land a paper-like surface.
    for(let i=0;i<220;i++) {
      const x=((i*137.508)%997)/997*w, y=70+((i*73.17)%983)/983*(h-70);
      ctx.fillStyle=dark?'#bacf9b0c':'#677b4410';ctx.fillRect(x,y,1.5,1);
    }
    ctx.restore();
  }
  // Short, gently drifting wavelets; no grid or busy contour lines.
  ctx.strokeStyle=dark?'#739da431':'#ffffff78';ctx.lineWidth=1;ctx.lineCap='round';
  for(let i=0;i<18;i++) {
    const x=w*(.33+((i*37)%29)/100)+Math.sin(time/2100+i)*2;
    const y=h*(.21+((i*19)%71)/100);
    ctx.beginPath();ctx.moveTo(x-5,y);ctx.quadraticCurveTo(x,y+2,x+5,y);ctx.stroke();
  }
  ctx.restore();
  return land;
}

export function artwork(ctx: CanvasRenderingContext2D, dark: boolean) {
  const outline = dark ? '#273d3f' : '#657d72';
  const cream = dark ? '#ede1bd' : '#fff4d6';
  const glass = dark ? '#ffe1a0' : '#a6d9db';
  const recess = dark ? '#385956' : '#759d8e';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const finish = (fill: string, stroke = true) => {
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = outline; ctx.lineWidth = 1.8; ctx.stroke(); }
  };
  const round = (x:number,y:number,w:number,h:number,r:number,fill:string,stroke=true) => {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); finish(fill,stroke);
  };
  const oval = (x:number,y:number,rx:number,ry:number,fill:string,stroke=false) => {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); finish(fill,stroke);
  };
  const line = (x:number,y:number,x2:number,y2:number,colour=outline,width=1.5) => {
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();
  };
  const shadow = (x:number,y:number,rx:number,ry:number) => oval(x,y,rx,ry,dark?'#102f3640':'#65856824');
  const window = (x:number,y:number,size=9) => {
    round(x,y,size,size,2.5,glass);
    line(x+2,y+2,x+2,y+size-3,'#fff9dc',1.3);
  };
  const tree = (x:number,y:number,size:number) => {
    shadow(x+2,y+3,size,2.5);
    line(x,y-size*.6,x,y+2,dark?'#b8a77a':'#a29369',2.5);
    oval(x,y-size*.75,size*.85,size*1.15,dark?'#81aa76':'#aecf85',true);
    oval(x-size*.22,y-size*1.1,size*.3,size*.5,dark?'#b0cf89':'#d6e8a8');
  };
  const roof = (colour:string,half=29,top=-38,bottom=-14) => {
    ctx.beginPath();ctx.moveTo(-half,bottom);
    ctx.quadraticCurveTo(-half-3,bottom-3,-half+2,bottom-7);
    ctx.lineTo(-5,top);ctx.quadraticCurveTo(0,top-4,5,top);
    ctx.lineTo(half-2,bottom-7);ctx.quadraticCurveTo(half+4,bottom-2,half,bottom);
    ctx.closePath();finish(colour);
    ctx.beginPath();ctx.moveTo(-half+7,bottom-6);ctx.lineTo(-3,top+4);
    ctx.strokeStyle='#fff9dc70';ctx.lineWidth=3;ctx.stroke();
  };
  const warehouse = (colour:string,arrival=0) => {
    shadow(2,15,32,6);
    ctx.save();ctx.translate(0,12);ctx.scale(1+arrival*.055,1-arrival*.08);ctx.translate(0,-12);
    round(-25,-20,50,33,7,cream);
    // A soft edge and broad roof make each depot read as a little toy shed.
    round(17,-17,7,28,3,dark?'#d3c9a5':'#e8dbb5',false);
    roof(colour);
    round(-13,-8,26,21,5,recess);
    for(let y=-3;y<10;y+=5) line(-10,y,10,y,dark?'#7e9d8b':'#a6c2a4',.8);
    window(-22,-7,6);window(16,-7,6);
    round(-6,-24,12,7,2,cream,false);
    line(-3,-20,3,-20,colour,2);
    ctx.restore();
  };
  const steam = (x:number,y:number,time:number,period:number) => {
    for(let i=0;i<3;i++) {
      const p=(time/period+i/3)%1;
      ctx.globalAlpha=(1-p)*.5;
      oval(x+Math.sin(p*4)*4+p*7,y-p*23,3+p*4,3+p*3,dark?'#e2e9db':'#fffdf3');
    }
    ctx.globalAlpha=1;
  };
  const factory = (time:number) => {
    shadow(2,15,34,6);
    steam(17,-34,time,2300);
    round(11,-33,12,28,4,dark?'#deaa8b':'#e8b49a');
    round(8,-35,18,7,3,cream);
    round(-28,-17,56,30,7,cream);
    ctx.beginPath();ctx.moveTo(-31,-16);ctx.lineTo(-31,-23);
    ctx.quadraticCurveTo(-31,-27,-27,-29);ctx.lineTo(-11,-37);
    ctx.quadraticCurveTo(-7,-39,-7,-33);ctx.lineTo(-7,-23);ctx.lineTo(10,-34);
    ctx.quadraticCurveTo(14,-36,14,-30);ctx.lineTo(14,-17);ctx.closePath();finish(dark?'#9eaae0':'#b3bce7');
    window(-22,-8);window(-8,-8);
    round(8,-4,14,17,5,recess);
    // A turning flywheel adds a small, recognisable beat of production.
    ctx.save();ctx.translate(19,-17);ctx.rotate(time/800);
    oval(0,0,7,7,dark?'#f4c97c':'#f3ce85',true);
    for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);line(0,0,4,0,outline,1.3);}
    oval(0,0,2,2,cream);ctx.restore();
  };
  const customs = (open:number) => {
    shadow(0,13,32,6);
    round(-28,-21,27,33,5,cream);
    round(-31,-25,33,8,4,dark?'#88beb2':'#9ccdc0');
    window(-22,-14,15);
    round(-20,5,10,7,2,dark?'#c0b58e':'#ddd0ab',false);
    round(20,-13,6,26,3,cream);
    ctx.save();ctx.translate(23,-11);ctx.rotate(open*Math.PI*.45);
    round(-35,-3,38,6,3,dark?'#e9a487':'#eaa084');
    ctx.save();ctx.beginPath();ctx.roundRect(-35,-3,38,6,3);ctx.clip();
    for(let i=-30;i<0;i+=10)line(i,-4,i+3,4,cream,4);
    ctx.restore();ctx.restore();
  };
  const ship = (colour:string,time:number) => {
    shadow(1,19,30,4);
    for(let i=0;i<3;i++) {
      const p=(time/900+i/3)%1;
      ctx.globalAlpha=(1-p)*.65;
      ctx.beginPath();ctx.ellipse(-31-p*20,16,8+p*4,2+p*2,0,0,Math.PI);
      ctx.strokeStyle=dark?'#a6d8d1':'#fffef3';ctx.lineWidth=1.5;ctx.stroke();
    }
    ctx.globalAlpha=1;
    steam(-17,-28,time,1800);
    round(-22,-26,8,11,3,dark?'#f0ae88':'#e7a283');
    round(-25,-21,23,24,6,cream);
    round(-28,-23,29,6,3,colour);
    window(-20,-16,11);
    ctx.beginPath();ctx.moveTo(-31,0);ctx.quadraticCurveTo(-34,1,-30,8);
    ctx.quadraticCurveTo(-24,20,-10,20);ctx.lineTo(15,20);
    ctx.quadraticCurveTo(28,18,34,2);ctx.quadraticCurveTo(35,-1,30,0);
    ctx.closePath();finish(colour);
    ctx.beginPath();ctx.moveTo(-28,4);ctx.quadraticCurveTo(0,8,29,4);
    ctx.strokeStyle=cream;ctx.lineWidth=4;ctx.stroke();
    for(const x of [-17,-3,11]) oval(x,12,2.4,2.4,cream);
    line(26,-11,26,0,outline,1.3);
    ctx.beginPath();ctx.moveTo(26,-12);ctx.quadraticCurveTo(32,-14+Math.sin(time/220)*2,35,-9);
    ctx.lineTo(26,-6);ctx.closePath();finish(dark?'#ffd085':'#efb267',false);
  };
  const home = (time=0) => {
    shadow(1,14,25,5);
    round(-18,-17,36,30,6,cream);
    round(10,-33,7,17,2,dark?'#df9d82':'#d99b81');
    roof(dark?'#edaa87':'#efb393',24,-36,-13);
    round(-4,-1,9,14,4,dark?'#a4be9b':'#a8c7a1');
    oval(2,7,1,1,outline);
    window(-14,-7,7);window(8,-7,7);
    tree(-26,9,7);
    // A tiny pennant flutters; the customer remains in one place.
    line(24,11,24,-5,outline,1);
    ctx.beginPath();ctx.moveTo(24,-5);ctx.quadraticCurveTo(29,-7+Math.sin(time/320),32,-3);ctx.lineTo(24,1);ctx.closePath();finish(dark?'#f4c277':'#e8ad63',false);
  };
  return { warehouse,factory,customs,ship,home,tree,shadow };
}
