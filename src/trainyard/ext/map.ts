declare global {
    interface Map<K, V> {
        /**
         * Get the value associated with the key and then delete it from the map.
         * @param k the key
         */
        popItem(k: K): V | undefined;

        /**
         * Get the value associated with the key or set it if it does not exist.
         * @param k 
         */
        setDefault(k: K, def: () => V): V;
    }
}

Object.defineProperty(Map.prototype, "popItem", {value: 
    function popItem<K, V>(this: Map<K, V>, k: K): V | undefined {
        const v = this.get(k);
        this.delete(k);
        return v;
    }
});

Object.defineProperty(Map.prototype, "setDefault", {value: 
    function setDefault<K, V>(this: Map<K, V>, k: K, def: () => V): V {
        if (!this.has(k)) {
            this.set(k, def());
        }
        
        return this.get(k)!;
    }
});

export {};