const STORAGE_KEY = "hoseimaster_cafe_date_scope_v2";

export function getTodayJST() {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

export function getDateScope(defaultMode = "all") {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved?.mode === "all") return { mode: "all", date: null };
        if (/^\d{4}-\d{2}-\d{2}$/.test(saved?.date || "")) {
            return { mode: "date", date: saved.date };
        }
    } catch {}

    return defaultMode === "all"
        ? { mode: "all", date: null }
        : { mode: "date", date: getTodayJST() };
}

export function setDateScope(mode, date) {
    const scope = mode === "all"
        ? { mode: "all", date: null }
        : { mode: "date", date: date || getTodayJST() };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
    document.dispatchEvent(new CustomEvent("app:datescopechange", { detail: scope }));
    return scope;
}

export function setupDateScopeControls({ modeElement, dateElement, defaultMode = "all", onChange }) {
    if (!modeElement || !dateElement) return;

    const apply = (scope) => {
        modeElement.value = scope.mode;
        dateElement.value = scope.date || getTodayJST();
        dateElement.hidden = scope.mode === "all";
        dateElement.disabled = scope.mode === "all";
    };

    apply(getDateScope(defaultMode));

    modeElement.addEventListener("change", () => {
        const scope = setDateScope(modeElement.value, dateElement.value);
        apply(scope);
        onChange?.(scope);
    });

    dateElement.addEventListener("change", () => {
        if (!dateElement.value) dateElement.value = getTodayJST();
        const scope = setDateScope("date", dateElement.value);
        apply(scope);
        onChange?.(scope);
    });

    document.addEventListener("app:datescopechange", (event) => apply(event.detail));
}

export function applyDateFilter(query, column, scope = getDateScope()) {
    return scope.mode === "date" && scope.date
        ? query.eq(column, scope.date)
        : query;
}
