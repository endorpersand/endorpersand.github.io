declare global {
    interface ReadonlyArray<T> {
        /**
         * Check if two arrays are equal -- if the two arrays are the same length and all its elements are identical
         * @param other 
         */
        equals(other: this): boolean;

        /**
         * Check if two arrays are deeply equal -- if the two arrays are the same length and all its elements are deeply equal
         * @param other 
         */
        deepEquals(other: this): boolean;
    }
}

Object.defineProperty(Array.prototype, "equals", {value: 
    function equals<T extends readonly any[]>(this: T, other: T) {
        if (this === other) return true;

        return this.length === other.length 
            && this.every((x, i) => x === other[i]);
    }
});

Object.defineProperty(Array.prototype, "deepEquals", {value: 
    function deepEquals<T extends readonly any[]>(this: T, other: T) {
        if (this === other) return true;

        return this.length === other.length
            && this.every((x, i) => {
                const o = other[i];
                const proto = Object.getPrototypeOf(x);

                if (x == o) return true;
                
                if ("deepEquals" in proto) return x.deepEquals(o);
                if ("equals" in proto) return x.equals(o);
            });
    }
});

export {};