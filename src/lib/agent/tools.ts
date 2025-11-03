export function safeCalc(expr: string): string {
    const ok = /^[\d+\-*/().\s]+$/.test(expr);
    if (!ok) return "Refusing: only simple arithmetic allowed.";
    try {
        const val = Function(`"use strict";return (${expr})`)();
        if (typeof val !== "number" || !isFinite(val)) return "Invalid expression.";
        return String(val);
    } catch {
        return "Invalid expression.";
    }
}
