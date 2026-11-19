// World units are metres. The camera looks along +z, with the runner at z = 8.
function createScene(canvas, laneWidth) {
    const ctx = canvas.getContext('2d');
    let w, h, horizon, center, focal;
    const tau = Math.PI * 2;
    function resize() {
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    }
    resize();
    new ResizeObserver(resize).observe(canvas);
    function polygon(color, points) {
        ctx.beginPath();
        points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
    function ellipse(color,x,y,rx,ry) {
        ctx.beginPath();
        ctx.ellipse(x,y,rx,ry,0,0,tau);
        ctx.fillStyle=color;
        ctx.fill();
    }
    function gradient(y1,y2,colors) {
        const g=ctx.createLinearGradient(0,y1,0,y2);
        colors.forEach(([n,c])=>g.addColorStop(n,c));
        return g;
    }
    function project(x,y,z) {
        return [center+x*focal/z, horizon+(2.9-y)*focal/z];
    }
    function face(color,...points) { polygon(color,points.map(p=>project(...p))); }
    function island(x,y,size,colors) {
        // Angular ridges and alternating facets share a single shoreline.
        const ridge=[[-1,0],[-.72,-.12],[-.46,-.42],[-.32,-.37],[-.14,-.72],[.01,-.7],[.19,-.45],[.31,-.4],[.51,-.19],[.78,-.12],[1,0]];
        const pt=([a,b])=>[x+a*size,y+b*size];
        polygon(colors[0],ridge.map(pt));
        for(let i=1;i<ridge.length-1;i++) {
            const [a,b]=ridge[i];
            polygon(colors[i%colors.length],[pt([a,b]),pt(ridge[i+1]),pt([a-.17,0])]);
        }
    }
    function palm(x,y,size,lean) {
        ctx.save();ctx.translate(x,y);ctx.scale(size*lean,size);
        polygon('#433e37',[[-.07,0],[.04,0],[.13,-.55],[.21,-1.04],[.15,-1.04],[.04,-.55]]);
        for(let k=0;k<9;k++) {
            const a=k*tau/9, dx=Math.cos(a)*.67,dy=Math.sin(a)*.28;
            const tip=[.18+dx,-1+dy+.15];
            polygon(k%2?'#184645':'#225553',[[.18,-1],[.18+dx*.45,-1.24+dy*.48],tip,[.18+dx*.62,-1.04+dy*.6]]);
            polygon('#37605a',[[.18,-1],[.18+dx*.45,-1.24+dy*.48],tip]);
        }
        ctx.restore();
    }
    function landscape(t) {
        ctx.fillStyle=gradient(0,horizon,[[0,'#364864'],[.44,'#bd8292'],[.77,'#ffae81'],[1,'#ffdb9b']]);
        ctx.fillRect(0,0,w,horizon+1);
        const sunX=center+w*.105, sunY=horizon-h*.17,r=h*.095;
        const halo=ctx.createRadialGradient(sunX,sunY,r*.6,sunX,sunY,r*2.4);
        halo.addColorStop(0,'#ffcf9699');halo.addColorStop(1,'#ffd49b00');
        ctx.fillStyle=halo;ctx.fillRect(sunX-r*2.4,sunY-r*2.4,r*4.8,r*4.8);
        ellipse('#ffe6aa',sunX,sunY,r,r);
        for(let i=0;i<12;i++){
            const x=(i*.373%1)*w,y=horizon*(.12+(i*.137% .59));
            ellipse('#ffddd138',x,y,w*(.025+i%4*.012),h*.0025);
        }
        island(center-w*.48,horizon,w*.32,['#70677a','#896e7e','#78677b']);
        island(center+w*.44,horizon,w*.23,['#827283','#a17c87','#917586']);
        island(center,horizon,Math.min(w*.34,h*.46),['#445566','#536074','#705e71','#384f5b','#635d70']);
        ctx.fillStyle=gradient(horizon,h,[[0,'#91c1ad'],[.14,'#539c98'],[.62,'#236c75'],[1,'#184251']]);
        ctx.fillRect(0,horizon,w,h-horizon);
        for(let i=0;i<170;i++){
            const depth=((i*.61803+t*.019)%1)**2;
            const x=((i*.38291)%1)*w,y=horizon+depth*(h-horizon);
            ellipse(Math.abs(x-sunX)<r*(.4+depth)?'#f9d39699':'#c3e0c54d',x,y,w*(.002+depth*.019),.5+depth*h*.0017);
        }
        for(const [side,offset,depth] of [[-1,.56,.11],[1,.47,.075],[-1,.25,.028],[1,.28,.034]]){
            const x=center+side*w*offset,y=horizon+h*depth,s=h*(depth+.012);
            ellipse('#b5c4a2',x,y,s*2.1,s*.09);
            island(x,y,s*2,['#37585a','#406361','#547066']);
            palm(x+s*.26,y-s*.37,s*1.5,side);
            palm(x-s*.42,y-s*.24,s*1.04,-side);
        }
    }
    function box(x,y,z,rx,height,rz,colors) {
        const l=x-rx,r=x+rx,n=z-rz,f=z+rz,top=y+height;
        face(colors[0],[l,top,n],[r,top,n],[r,y,n],[l,y,n]);
        const edge=x>0?l:r;
        face(colors[1],[edge,top,f],[edge,top,n],[edge,y,n],[edge,y,f]);
        face(colors[2],[l,top,f],[r,top,f],[r,top,n],[l,top,n]);
    }
    function torch(x,z,t) {
        box(x,-.15,z,.12,1.84,.12,['#574337','#392f32','#97784e']);
        for(const y of [.15,1.27,1.5]) box(x,y,z,.15,.09,.15,['#c59b63','#89714d','#dbc194']);
        const [px,py]=project(x,1.68,z),s=focal/z;
        const glow=ctx.createRadialGradient(px,py,0,px,py,s*.7);
        glow.addColorStop(0,'#ffb84777');glow.addColorStop(1,'#ffc16400');
        ellipse(glow,px,py,s*.7,s*.7);
        polygon('#ff8c39',[[px-s*.13,py],[px+s*.04,py-s*(.64+.08*Math.sin(t*9+z))],[px+s*.15,py],[px,py+s*.12]]);
        polygon('#ffe79b',[[px-s*.07,py],[px,py-s*.3],[px+s*.07,py]]);
    }
    function road(distance) {
        const stone=['#a88672','#b7957a','#ad907c','#bc9980'];
        const edge=2.45;
        face('#8b7266',[-edge,0,200],[edge,0,200],[edge,0,.8],[-edge,0,.8]);
        for(let i=75;i>=0;i--){
            const z=1+i*2-distance%2,n=Math.max(.8,z),f=z+1.98;
            if(f<=n)continue;
            const row=i+Math.floor(distance/2);
            const seam=(row%3-1)*.85;
            face(stone[row%4],[-edge,0,f],[seam,0,f],[seam-.2,0,n],[-edge,0,n]);
            face(stone[(row+1)%4],[seam+.025,0,f],[edge,0,f],[edge,0,n],[seam-.175,0,n]);
            for(const side of [-1,1]){
                const joint = side * laneWidth/2;
                face('#d5b193',[joint,0,f],[joint+.035,0,f],[joint+.035,0,n],[joint,0,n]);
                const x=edge*side, outer=x+side*.24;
                face('#584a44',[outer,0,f],[outer,0,n],[outer,-.5,n],[outer,-.5,f]);
                face(row%2?'#e0b88c':'#c9a079',[x,.035,f],[outer,.035,f],[outer,.035,n],[x,.035,n]);
            }
        }
    }
    function gem(x,z,t) {
        const y=1.12+.09*Math.sin(t*3+z), ring=[];
        for(let i=0;i<6;i++){const a=i*tau/6+t*2;ring.push([x+Math.cos(a)*.28,y,z+Math.sin(a)*.28]);}
        const facets=ring.map((p,i)=>[p,ring[(i+1)%6],i]).sort((a,b)=>b[0][2]+b[1][2]-a[0][2]-a[1][2]);
        for(const [a,b,i] of facets){
            face(['#fff2aa','#ffd36a','#f5af41'][i%3],a,b,[x,y+.42,z]);
            face(['#e99932','#c47728','#edac44'][i%3],a,b,[x,y-.38,z]);
        }
    }
    function obstacle(e,z) {
        const wood=['#884735','#582f32','#c88555'];
        if(e.kind==='gate'){
            for(const offset of [-.71,.71])box(e.x+offset,0,z,.08,1.85,.17,wood);
            box(e.x,1.12,z,.8,.68,.19,wood);
        }else{box(e.x,0,z,.76,.67,.25,wood);}
        const y=e.kind==='gate'?1.45:.34, front=z-(e.kind==='gate'?.20:.26);
        for(let i=-1;i<=1;i++){
            const x=e.x+i*.42;
            face('#f3c183',[x-.19,y,front],[x,y+.17,front],[x+.19,y,front],[x,y-.17,front]);
        }
    }
    const athlete=new Image();
    athlete.src='assets/runner-poses.webp';
    function runner(player,distance,active) {
        const scale=focal/8, [x,ground]=project(player.x,0,8);
        ellipse('#3e40474d',x,ground,scale*.37,scale*.10);
        if(!athlete.naturalWidth)return;
        const phase=Math.floor(distance/4.25*8)%8;
        let frame=phase,row=0;
        if(!active){row=2;frame=7;}
        else if(player.crouch>.08){row=1;frame=Math.round(player.crouch*7);}
        else if(player.y>.08){row=2;frame=Math.min(6,phase);}
        ctx.save();
        ctx.translate(x,ground-player.y*scale);
        ctx.rotate((player.lane*laneWidth-player.x)*.1);
        ctx.drawImage(athlete,frame*160,row*224,160,224,-.75*scale,-1.92*scale,1.5*scale,2.1*scale);
        ctx.restore();
    }
    return function draw(state, distance, player, entities, time, menuBlend) {
        const portrait=w<h*.84;
        center=w*(.5+menuBlend*(portrait?.12:.19));
        horizon=h*((portrait?.45:.43)+menuBlend*(portrait?.10:0));
        focal=Math.min(h*(portrait?.98:1.18),w*1.65);
        landscape(time);road(distance);
        const items=[];
        for(let i=0;i<13;i++){
            const z=4+i*11-distance%11;
            if(z>2)items.push({z,draw:()=>{torch(-2.69,z,time);torch(2.69,z,time);}});
        }
        for(const e of entities){
            const z=e.at-distance+8;
            if(z>1.5&&z<155)items.push({z,draw:()=>e.kind==='gem'?gem(e.x,z,time):obstacle(e,z)});
        }
        items.push({z:8,draw:()=>runner(player,distance,state==='playing')});
        items.sort((a,b)=>b.z-a.z).forEach(item=>item.draw());
        const shade=ctx.createLinearGradient(0,0,portrait?0:w,portrait?h:0);
        shade.addColorStop(0,`rgba(14,33,45,${.12+.74*menuBlend})`);
        shade.addColorStop(.52,`rgba(14,33,45,${.02+.25*menuBlend})`);shade.addColorStop(1,'transparent');
        ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
        ctx.fillStyle=gradient(0,h,[[0,'#14233377'],[.18,'transparent'],[.8,'transparent'],[1,'#172b38a8']]);
        ctx.fillRect(0,0,w,h);
    };
}
