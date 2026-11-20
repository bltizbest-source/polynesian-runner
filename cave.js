// Cave coordinates use distance along the path, shared by both renderers.
export const tripStoneAt = 4.2;
export const caveFaces = [];
const colors = [0x34404a, 0x41484a, 0x39434b, 0x505452, 0x303a42];
const inner = [], outer = [];
for (let row = 0; row <= 7; row++) {
    const arch = [], rim = [];
    for (let i = 0; i <= 10; i++) {
        const angle = i * Math.PI / 10;
        const seam = Math.sin(row*5.3 + i*2.7);
        const d = 1.25 + row*1.12 + seam*.28;
        const x = Math.cos(angle) * (3.45 + .24*seam);
        const y = -.45 + Math.sin(angle) * (4.65 + .26*seam);
        arch.push([x,y,d]);
        rim.push([x*1.52,y*1.26,d + (row===0 ? -.65 : .45)]);
    }
    inner.push(arch); outer.push(rim);
}
function facet(a,b,c,d,n) {
    caveFaces.push({vertices:[a,b,c],color:colors[n%5]},
        {vertices:[a,c,d],color:colors[(n+2)%5]});
}
for (let row=0; row<inner.length; row++) {
    for (let i=0; i<10; i++) {
        if (row===0 || row===7)
            facet(inner[row][i],inner[row][i+1],outer[row][i+1],outer[row][i],row+i);
        if (row===7) continue;
        for (const surface of [inner,outer])
            facet(surface[row][i],surface[row+1][i],surface[row+1][i+1],surface[row][i+1],row*7+i);
    }
}
