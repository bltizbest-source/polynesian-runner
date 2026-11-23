const status = document.getElementById('offline-status');
const retry = document.getElementById('offline-retry');
const workerURL = new URL('./sw.js?v=36', import.meta.url).href;

function showFailure() {
    status.textContent = 'Offline download incomplete.';
    retry.hidden = false;
}

function verifyDownload(worker) {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({data}) => {
        channel.port1.close();
        if (data.ready) status.textContent = 'Ready to play offline';
        else showFailure();
    };
    worker.postMessage('prepare-offline', [channel.port2]);
}

function watchDownload(registration) {
    const worker = [registration.installing, registration.waiting, registration.active]
        .find(candidate => candidate?.scriptURL === workerURL);
    if (!worker) {
        showFailure();
        return;
    }
    function update() {
        if (worker.state === 'activated') verifyDownload(worker);
        else if (worker.state === 'redundant') showFailure();
        else return;
        worker.removeEventListener('statechange', update);
    }
    worker.addEventListener('statechange', update);
    update();
}

async function prepareOffline() {
    retry.hidden = true;
    status.textContent = 'Saving game for offline play…';
    try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing?.active?.scriptURL === workerURL) watchDownload(existing);
        else watchDownload(await navigator.serviceWorker.register(workerURL, {updateViaCache:'none'}));
    } catch {
        showFailure();
    }
}

if ('serviceWorker' in navigator) {
    retry.addEventListener('click', prepareOffline);
    window.addEventListener('online', () => { if (!retry.hidden) prepareOffline(); });
    prepareOffline();
} else {
    status.textContent = 'Offline play is unavailable in this browser.';
}
