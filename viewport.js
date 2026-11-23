// Limit the backing buffer independently of the CSS viewport, including at 4K.
export function renderPixelRatio(width, height) {
    return Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(3200000 / (width * height)));
}

// On iPhone a Home Screen window can get a shorter layout viewport on resume.
// Size only the scenery to the screen. Menus and touch targets use the visible area.
export function fitGameScreen() {
    const standalone=matchMedia('(display-mode: standalone)');
    function update(){
        const root=document.documentElement;
        const portrait=innerHeight>=innerWidth;
        const short=Math.min(screen.width,screen.height),long=Math.max(screen.width,screen.height);
        const width=portrait?short:long, height=portrait?long:short;
        const gap=height-innerHeight;
        if((navigator.standalone || standalone.matches) && navigator.maxTouchPoints>0 &&
            Math.abs(innerWidth-width)<=1 && gap>0 && gap<=100 && (window.visualViewport?.scale ?? 1)===1){
            root.style.setProperty('--game-screen-height',height+'px');
        }else root.style.removeProperty('--game-screen-height');
    }
    update();
    window.addEventListener('pageshow',update);
    window.addEventListener('resize',update);
    window.visualViewport?.addEventListener('resize',update);
    document.addEventListener('visibilitychange',update);
    standalone.addEventListener('change',update);
}
