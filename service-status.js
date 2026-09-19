import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const CHECK_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 7000;
const RETRY_DELAY_MS = 1200;

let initialized = false;
let monitorTimer = null;
let checking = false;
let currentStatus = "unknown";

export async function initializeServiceStatus() {
    ensureStatusScreen();
    setupEvents();

    const available = await checkServiceAvailability({ retry: true });

    if (!initialized) {
        initialized = true;
        startServiceStatusMonitor();
    }

    return available;
}

export function startServiceStatusMonitor() {
    stopServiceStatusMonitor();

    monitorTimer = window.setInterval(
        () => void checkServiceAvailability({ retry: false }),
        CHECK_INTERVAL_MS
    );
}

export function stopServiceStatusMonitor() {
    if (monitorTimer !== null) {
        window.clearInterval(monitorTimer);
        monitorTimer = null;
    }
}

export async function checkServiceAvailability({ retry = true } = {}) {
    if (checking) {
        return currentStatus === "available";
    }

    checking = true;

    try {
        if (!navigator.onLine) {
            setStatus("offline");
            return false;
        }

        let result = await requestHealth();

        if (!result.available && retry) {
            await wait(RETRY_DELAY_MS);

            if (!navigator.onLine) {
                setStatus("offline");
                return false;
            }

            result = await requestHealth();
        }

        setStatus(result.available ? "available" : "unavailable");
        return result.available;

    } finally {
        checking = false;
    }
}

async function requestHealth() {
    const controller = new AbortController();
    const timeout = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    );

    try {
        const response = await fetch(
            `${SUPABASE_URL}/auth/v1/health`,
            {
                method: "GET",
                headers: {
                    apikey: SUPABASE_PUBLISHABLE_KEY
                },
                cache: "no-store",
                signal: controller.signal
            }
        );

        return {
            available: response.ok,
            status: response.status
        };

    } catch (error) {
        return {
            available: false,
            status: 0,
            error
        };

    } finally {
        window.clearTimeout(timeout);
    }
}

function setStatus(status) {
    const previousStatus = currentStatus;
    currentStatus = status;

    if (status === "available") {
        hideStatusScreen();

        if (previousStatus === "unavailable" || previousStatus === "offline") {
            window.dispatchEvent(
                new CustomEvent("app:service-restored")
            );
        }

        return;
    }

    showStatusScreen(status);
}

function ensureStatusScreen() {
    if (document.getElementById("serviceStatusOverlay")) {
        return;
    }

    const overlay = document.createElement("div");
    overlay.id = "serviceStatusOverlay";
    overlay.className = "service-status-overlay";
    overlay.hidden = true;

    overlay.innerHTML = `
        <div class="service-status-card" role="alert" aria-live="assertive">
            <div class="service-status-mark" aria-hidden="true">!</div>
            <h1 id="serviceStatusTitle">システムを一時停止しています</h1>
            <p id="serviceStatusMessage"></p>
            <div class="service-status-state">
                <span class="service-status-dot" aria-hidden="true"></span>
                <span id="serviceStatusStateText">接続状況を確認しています</span>
            </div>
            <button type="button" id="serviceStatusRetry" class="service-status-retry">
                再接続する
            </button>
            <p class="service-status-note">
                復旧を確認すると、この画面は自動的に解除されます。
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
}

function showStatusScreen(status) {
    ensureStatusScreen();

    const overlay = document.getElementById("serviceStatusOverlay");
    const title = document.getElementById("serviceStatusTitle");
    const message = document.getElementById("serviceStatusMessage");
    const state = document.getElementById("serviceStatusStateText");

    if (!overlay || !title || !message || !state) {
        return;
    }

    if (status === "offline") {
        title.textContent = "通信環境を確認してください";
        message.textContent =
            "ネットワークに接続できません。通信環境を確認してから再接続してください。";
        state.textContent = "ネットワーク未接続";
        overlay.dataset.status = "offline";
    } else {
        title.textContent = "システムを一時停止しています";
        message.textContent =
            "現在、システム基盤への接続が一時的に利用できません。復旧までしばらくお待ちください。";
        state.textContent = "システム基盤へ接続できません";
        overlay.dataset.status = "unavailable";
    }

    overlay.hidden = false;
    document.documentElement.classList.add("service-status-active");
    document.body.classList.add("service-status-active");
}

function hideStatusScreen() {
    const overlay = document.getElementById("serviceStatusOverlay");

    if (overlay) {
        overlay.hidden = true;
        delete overlay.dataset.status;
    }

    document.documentElement.classList.remove("service-status-active");
    document.body.classList.remove("service-status-active");
}

function setupEvents() {
    document.addEventListener("click", async (event) => {
        const button = event.target.closest("#serviceStatusRetry");

        if (!button) {
            return;
        }

        button.disabled = true;
        button.textContent = "再接続中…";

        try {
            await checkServiceAvailability({ retry: true });
        } finally {
            button.disabled = false;
            button.textContent = "再接続する";
        }
    });

    window.addEventListener("online", () => {
        void checkServiceAvailability({ retry: true });
    });

    window.addEventListener("offline", () => {
        setStatus("offline");
    });
}

function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
