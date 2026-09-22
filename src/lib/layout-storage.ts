import type { LayoutStorage } from "react-resizable-panels";

// The library's default storage evaluates localStorage during server rendering.
// Resolve it lazily, and keep the workbench usable when storage is unavailable.
export const layoutStorage: LayoutStorage = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing and quota limits should not prevent resizing panels.
    }
  },
};
