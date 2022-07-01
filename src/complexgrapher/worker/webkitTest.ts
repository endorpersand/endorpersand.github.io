// On WebKit (iOS), nested Workers are not supported. So test if they are supported,
// and if not, use the fallback that doesn't use nested Workers.

onmessage = (e: any) => {
    self.postMessage(typeof globalThis.Worker !== "undefined");
}