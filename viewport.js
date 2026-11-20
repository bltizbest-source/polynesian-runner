// Limit the backing buffer independently of the CSS viewport, including at 4K.
export function renderPixelRatio(width, height) {
    return Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(3200000 / (width * height)));
}
