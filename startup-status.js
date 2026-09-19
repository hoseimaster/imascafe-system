const STEP_ORDER = ["page", "system", "server", "session"];

export function showStartupScreen() {
    const screen = document.getElementById("startupScreen");
    const login = document.getElementById("loginScreen");
    const main = document.getElementById("mainApp");
    if (screen) screen.hidden = false;
    if (login) login.hidden = true;
    if (main) main.hidden = true;
}

export function updateStartupStep(step, state) {
    const element = document.querySelector(`[data-startup-step="${step}"]`);
    if (!element) return;
    element.classList.remove("is-active", "is-done", "is-error");
    if (state === "active") element.classList.add("is-active");
    if (state === "done") element.classList.add("is-done");
    if (state === "error") element.classList.add("is-error");
    const index = STEP_ORDER.indexOf(step);
    const progress = document.getElementById("startupProgressBar");
    if (progress && index >= 0) {
        const value = state === "done" ? index + 1 : index + 0.45;
        progress.style.width = `${Math.max(8, value / STEP_ORDER.length * 100)}%`;
    }
    const message = document.getElementById("startupMessage");
    if (message && state === "active") message.textContent = element.querySelector("p")?.textContent || "起動しています";
}

export function finishStartupScreen() {
    const screen = document.getElementById("startupScreen");
    const progress = document.getElementById("startupProgressBar");
    if (progress) progress.style.width = "100%";
    if (screen) screen.hidden = true;
}

export function failStartupScreen(message) {
    const screen = document.getElementById("startupScreen");
    const text = document.getElementById("startupMessage");
    if (screen) screen.hidden = false;
    if (text) text.textContent = message || "起動処理を完了できませんでした";
    screen?.classList.add("has-error");
}
