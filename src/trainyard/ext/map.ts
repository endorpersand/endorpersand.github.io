declare global {
    interface Map<K, V> {
        /**
         * Get the value associated with the key and then delete it from the map.
         * @param k the key
         */
        popItem(k: K): V | undefined;
    }
}

Object.defineProperty(Map.prototype, "popItem", {value: 
    function popItem<K, V>(this: Map<K, V>, k: K): V | undefined {
        const v = this.get(k);
        this.delete(k);
        return v;
    }
});

export {};