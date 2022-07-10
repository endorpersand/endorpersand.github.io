import { TileGrid } from "./logic";

export namespace Elements {
    export const slider = document.querySelector("#speed-controls > input[type=range]")! as HTMLInputElement;
    export const input  = document.querySelector("#speed-controls > input[type=number]")! as HTMLInputElement;
    
    export const wrapper = document.querySelector("#wrapper")! as HTMLDivElement;
    export const erase = wrapper.querySelector("button#b-erase")! as HTMLButtonElement;
    export const undo  = wrapper.querySelector("button#b-undo")! as HTMLButtonElement;
    export const start = wrapper.querySelector("button#b-start")! as HTMLButtonElement;
    export const step  = wrapper.querySelector("button#b-step")! as HTMLButtonElement;
}
const {slider, input} = Elements;

let _speed: number = 1;
input.value = _speed.toFixed(2);

slider.addEventListener("input", () => {
    _speed = Computing.speed(+slider.value / 50);
    input.value = _speed.toFixed(2);
});

input.addEventListener("input", () => {
    _speed = +input.value;
    slider.value = "" + Computing.sliderDistance(_speed);
});
namespace Computing {
    /**
     * Compute the speed from the slider distance
     * @param x slider distance
     * @returns speed
     */
    export function speed(x: number) {
        return (2/3 * x**3) - (x**2) + (4/3 * x);
    }

    /**
     * Compute the slider distance from the speed
     * @param y speed
     * @returns slider distance
     */
    export function sliderDistance(y: number) {
        // https://en.wikipedia.org/wiki/Newton's_method
    
        let x0: number = -Infinity; 
        let x1: number = 0;
        while (x0.toFixed(3) !== x1.toFixed(3)) {
            x0 = x1;
            x1 -= (speed(x1) - y) / (2 * x1 ** 2 - 2 * x1 + 4 / 3);
        }
    
        return Math.min(Math.max(0, x1 * 50), 100);
    }
}

export function speed() { return _speed; }

const {erase, undo, start, step} = Elements;

export function applyButtons(grid: TileGrid) {
    erase.addEventListener("click", () => {
        let em = grid.editMode;
        if (em === "rail") grid.editMode = "railErase";
        else if (em === "railErase") grid.editMode = "rail";
    });
    undo.addEventListener("click", () => {
        grid.undo();
    })
    start.addEventListener("click", () => {
        let em = grid.editMode;

        if (em === "readonly") grid.editMode = "rail";
        else grid.editMode = "readonly";
    })
    step.addEventListener("click", () => {
        let em = grid.editMode;

        if (em !== "readonly") {
            grid.editMode = "readonly";
        } else {
            grid.simulation?.step();
        }

        slider.value = "0";
    });

    grid.on("enterRailErase", () => {
        // enable erase mode
        document.body.classList.add("erase-mode");
        erase.classList.add("erase-mode");
        erase.textContent = "Stop Erasing";
    });
    grid.on("exitRailErase", () => {
        // reset erase mode
        document.body.classList.remove("erase-mode");
        erase.classList.remove("erase-mode");
        erase.textContent = "Erase";
    });

    grid.on("enterReadonly", () => {
        // set readonly mode active
        document.body.classList.add("readonly-mode");
        start.classList.add("readonly-mode");
        start.textContent = "Return";
    });
    grid.on("exitReadonly", () => {
        // reset readonly mode
        document.body.classList.remove("readonly-mode");
        start.classList.remove("readonly-mode");
        start.textContent = "Start";
        document.body.classList.remove("failed");
    });

    grid.on("fail", () => {
        document.body.classList.add("failed");
    });
}