import A11yDialog from "a11y-dialog";
import * as LevelData from "./levels";
import { EditMode, EDIT_MODES, LoadableBoard, StageTile, TileGrid } from "./logic";
import { Dir, Modal } from "./values";

export namespace Elements {
    export const slider = document.querySelector<HTMLInputElement>("#speed-controls > input[type=range]")!;
    export const input  = document.querySelector<HTMLInputElement>("#speed-controls > input[type=number]")!;
    
    export const wrapper = document.querySelector<HTMLDivElement>("div#wrapper")!;
    export const erase = wrapper.querySelector<HTMLButtonElement>("button#b-erase")!;
    export const undo  = wrapper.querySelector<HTMLButtonElement>("button#b-undo")!;
    export const start = wrapper.querySelector<HTMLButtonElement>("button#b-start")!;
    export const step  = wrapper.querySelector<HTMLButtonElement>("button#b-step")!;

    export const dd = document.querySelectorAll<HTMLSelectElement>("#navbar select");
    export const modeToggle = document.querySelector<HTMLInputElement>("#navbar input[type=checkbox]")!;

    export const ttButtons = document.querySelectorAll<HTMLInputElement>("input[name=tile-type]");
    export const editTileBtn = document.querySelector<HTMLButtonElement>("button#edit-tile-btn")!;
    
    const emDiv = document.querySelector<HTMLDivElement>("div#tile-edit-modal")!;
    const emInner = emDiv.querySelector<HTMLDivElement>("div.modal-inner")!;
    const emFooter = emDiv.querySelector<HTMLDivElement>("div.modal-footer")!;
    const emModal = new A11yDialog(emDiv);
    export const EditModal = {
        Div: emDiv,
        Inner: emInner,
        Modal: emModal,
        Footer: emFooter
    } as const;

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

const {erase, undo, start, step, modeToggle, ttButtons, editTileBtn, EditModal} = Elements;

function documentEditMode(e: EditMode) {
    const classList = document.body.classList;

    classList.remove(...EDIT_MODES.map(t => `${t}-mode`));
    classList.add(`${e}-mode`);
}

export function applyButtons(grid: TileGrid) {
    const ANY = Symbol("any edit mode");

    function addListener<
    E extends HTMLElement,
    K extends keyof HTMLElementEventMap,
    EM extends EditMode[],
    >(
        element: E,
        event: K,
        allowedEms: EM | typeof ANY,
        listener: (this: E, grid: TileGrid & {editMode: EM[number]}, ev: HTMLElementEventMap[K]) => any
    ): void;

    function addListener<
    E extends Document,
    K extends keyof DocumentEventMap,
    EM extends EditMode[],
    >(
        element: E,
        event: K,
        allowedEms: EM | typeof ANY,
        listener: (this: E, grid: TileGrid & {editMode: EM[number]}, ev: DocumentEventMap[K]) => any
    ): void;

    function addListener<EM extends EditMode[]>(
        element: HTMLElement | Document,
        event: string,
        allowedEms: EM | typeof ANY,
        listener: (this: typeof element, grid: TileGrid & {editMode: EM[number]}, ev: Event) => any
    ) {
        element.addEventListener(event, e => {
            if (allowedEms === ANY || allowedEms.includes(grid.editMode)) {
                return listener.call(element, grid as any, e);
            }
        });
    }

    addListener(erase, "click", ["rail", "railErase"], grid => {
        let em = grid.editMode;
        if (em === "rail") grid.editMode = "railErase";
        else if (em === "railErase") grid.editMode = "rail";
    });

    addListener(undo, "click", ["rail", "railErase"], grid => {
        grid.undo();
    });

    addListener(start, "click", ANY, grid => {
        let em = grid.editMode;

        if (em === "readonly") grid.editMode = "rail";
        else grid.editMode = "readonly";
    });

    addListener(step, "click", ANY, grid => {
        let em = grid.editMode;

        if (em !== "readonly") {
            grid.editMode = "readonly";
        } else {
            grid.simulation?.step();
        }

        slider.value = "0";
        input.value = "0.00";
    });

    grid.on("switchEdit", () => {
        documentEditMode(grid.editMode);
    })
    documentEditMode(grid.editMode);
    
    const observer = new MutationObserver(records => {
        // if (!records.map(m => m.target).every(n => n === document.body)) {
        //     window.location.href = "";
        // }

        const classList = document.body.classList;
        const {reject, require} = grid.htmlRequire();
        const needsFixes: string[] = [];

        needsFixes.push(...require.filter(cls => !classList.contains(cls)));
        needsFixes.push(...reject.filter(cls => classList.contains(cls)));

        for (let cls of needsFixes) classList.toggle(cls);
    });
    observer.observe(document.body, {
        attributes: true, 
        attributeFilter: ['class'],
        subtree: true, 
        characterData: false
    });

    grid.on("enterRailErase", () => {
        erase.querySelector("span")!.textContent = "Stop Erasing";
    });
    grid.on("exitRailErase", () => {
        erase.querySelector("span")!.textContent = "Erase";
    });

    grid.on("enterReadonly", () => {
        start.querySelector("span")!.textContent = "Return";
    });
    grid.on("exitReadonly", () => {
        start.querySelector("span")!.textContent = "Start";
        document.body.classList.remove("failed");
    });

    grid.on("fail", () => {
        document.body.classList.add("failed");
    });

    grid.on("enterRail", () => {
        modeToggle.checked = false;
    })
    grid.on("enterLevel", () => {
        modeToggle.checked = true;
    })
    modeToggle.checked = grid.editMode === "level";

    addListener(modeToggle, "input", ANY, grid => {
        if (modeToggle.checked) grid.editMode = "level";
        else grid.editMode = "rail";
    });
    grid.pointerEvents.tt = { ttButtons, editTileBtn };

    for (let [i, b] of ttButtons.entries()) {
        addListener(b, "input", ["level"], grid => {
            const j: StageTile.Order = i;
            const pointerEvents = grid.pointerEvents;

            pointerEvents.setSquarePos(j);
            editTileBtn.disabled = !pointerEvents.stagePropertiesAt().modal;
        })
    }
    editTileBtn.disabled = !grid.pointerEvents.stagePropertiesAt().modal;

    addListener(editTileBtn, "click", ["level"], grid => {
        let okBut = EditModal.Footer.querySelector<HTMLButtonElement>("button#edit-modal-ok")!;
        
        let _okButClone = okBut.cloneNode(true);
        okBut.replaceWith(_okButClone);
        okBut = _okButClone as any;

        const modal = grid.pointerEvents.stagePropertiesAt().modal?.();
        if (modal) {
            const {inner, parse} = modal;
            EditModal.Inner.replaceChildren(...inner);

            // on ok, parse the square and set
            okBut.addEventListener("click", () => {
                const ag = document.querySelector<HTMLDivElement>(".actives-grid"); 
                const agInputs = ag?.querySelectorAll<HTMLInputElement>("label > input");

                const hg = document.querySelector<HTMLDivElement>(".hex-grid");
                // note that the other option here is <button> which can't be enabled
                const hgInputs = hg?.querySelectorAll<HTMLInputElement>("label > input");
                
                const dirs = agInputs ? Array.from( agInputs, (e, i) => [e, i] as const )
                    .filter(([e]) => e.checked)
                    .map(([_, i]): Dir => i)
                : undefined;

                const gridClrs = hgInputs ? Array.from( hgInputs, (e, i) => [e, i] as const )
                    .filter(([e]) => e.checked)
                    .map(([_, i]) => Modal.HexOrder[i])
                : undefined;
                    
                grid.pointerEvents.setSquare( parse({ dirs, gridClrs }) );
                EditModal.Modal.hide();
            });
            //
        } else {
            return;
        }

        EditModal.Modal.show();
    })

    const DirKeys: { [s: string]: Dir | undefined } = {
        ArrowLeft: Dir.Left,
        KeyA: Dir.Left,
        ArrowUp: Dir.Up,
        KeyW: Dir.Up,
        ArrowRight: Dir.Right,
        KeyD: Dir.Right,
        ArrowDown: Dir.Down,
        KeyS: Dir.Down,
    } as const;

    addListener(document, "keydown", ["level"], (grid, e) => {
        const pointerEvents = grid.pointerEvents;

        const d = DirKeys[e.code];
        if (EditModal.Div.ariaHidden) {
            if (typeof d !== "undefined") {
                pointerEvents.moveSquarePos(d);
            }

            if (e.code.startsWith("Digit")) {
                const d = +e.code.slice(5);
                if (1 <= d && d <= 6) ttButtons[d - 1].click();
            }

            if (e.code === "Enter") {
                editTileBtn.click();
            }
        } else {
            const ag = EditModal.Inner.querySelector(".actives-grid");
            if (ag) {
                const btns = ag.querySelectorAll<HTMLElement>(":scope > *");
                if (typeof d !== "undefined") {
                    btns[d].click();
                }
            }
            
            const hg = EditModal.Inner.querySelector(".hex-grid");
            if (hg) {
                const btns = hg.querySelectorAll<HTMLElement>(".hex-row > *");

                if (e.code.startsWith("Digit")) {
                    const d = +e.code.slice(5);
                    if (1 <= d && d <= 7) {
                        const btn = btns[Modal.HexMapping[d - 1]];

                        if (btn instanceof HTMLButtonElement && !btn.classList.contains("active")) {
                            btn.click();
                            btn.classList.add("active");
                        } else {
                            btn.click();
                        }
                    }
                }
            }

            const tl = EditModal.Inner.querySelector(".train-list");
            if (tl) {
                if (e.code === "Backspace") {
                    const delButs = tl.querySelectorAll<HTMLButtonElement>("button:enabled");
                    delButs[delButs.length - 1]?.click();
                }
            }

            if (e.code === "Enter") {
                EditModal.Footer.querySelector<HTMLButtonElement>("button#edit-modal-ok")!.click();
                // TODO: figure out why modal doesn't hide?
                // EditModal.Modal.hide();
            }
        }
    });

    addListener(document, "keydown", ["rail"], (grid, e) => {
        if (e.code === "KeyE") grid.editMode = "railErase" as any;
    });

    addListener(document, "keydown", ["rail", "railErase", "readonly"], (grid, e) => {
        if (e.code === "Enter") {
            if (e.getModifierState("Shift")) {
                step.click();
            } else {
                start.click();
            }
        }

        if (grid.editMode === "rail" || grid.editMode === "railErase") {
            if (e.code === "Backspace") {
                undo.click();
            }

            // TODO: hold down without flicker
            if (e.code === "KeyR") {
                erase.click();
            }
        }
    });

    addListener(document, "keydown", ANY, (grid, e) => {
        if (e.code === "Backquote") {
            document.body.classList.add("show-keys");
        }
    })
    addListener(document, "keyup", ANY, (grid, e) => {
        const hg = EditModal.Inner.querySelector(".hex-grid");
        const btns = hg?.querySelectorAll<HTMLButtonElement>(".hex-row > button");
        btns?.forEach(b => b.classList.remove("active"));

        document.body.classList.remove("show-keys");

        if (e.code === "KeyE" && grid.editMode === "railErase") {
            grid.editMode = "rail";
        }
    })
}

const [catDD, levelDD] = Elements.dd;
for (let cat of Object.keys(LevelData.ProvidedLevels)) {
    const opt = document.createElement("option");

    opt.value = cat;
    opt.textContent = cat;
    if (LevelData.Default[0] === cat) opt.selected = true;

    catDD.append(opt);
}

export namespace Dropdowns {
    export const [catDD, levelDD] = Elements.dd;

    export function selectedCat(): keyof typeof LevelData.ProvidedLevels {
        return catDD.value as any;
    }

    export function currentLevel(): LoadableBoard | null {
        const ld = LevelData.ProvidedLevels[selectedCat()] as any;
        return ld?.[levelDD.value];
    }

    
    export namespace LevelHandlers {
        type Handler = (b: LoadableBoard) => void;
        const handlers: Handler[] = [];

        export function add(h: Handler) {
            handlers.push(h);
        }

        export function remove(h: Handler) {
            const i = handlers.indexOf(h);
            if (i !== -1) handlers.splice(i, 1);
        }

        export function call() {
            const level = currentLevel();

            if (level) {
                for (let h of handlers) h(level);
            }
        }
    }
}
function updateLevelDD() {
    const catLevels = LevelData.ProvidedLevels[catDD.value as keyof typeof LevelData.ProvidedLevels];
    
    levelDD.replaceChildren(
        ...Object.keys(catLevels)
            .filter(k => (catLevels as any)[k] != null)
            .map(k => {
                const opt = document.createElement("option");
    
                opt.value = k;
                opt.textContent = k;
                if (LevelData.Default[1] === k) opt.selected = true;
                return opt;
        })
    );
}

updateLevelDD();

catDD.addEventListener("input", () => {
    updateLevelDD();
    Dropdowns.LevelHandlers.call();
});
levelDD.addEventListener("input", () => {
    Dropdowns.LevelHandlers.call();
});