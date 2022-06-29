onmessage = (e: any) => {
    self.postMessage(typeof globalThis.Worker !== "undefined");
}