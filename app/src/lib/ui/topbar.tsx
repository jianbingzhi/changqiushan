"use client";

import { ChevronDown, HelpCircle, Bell, Maximize2, Sun, Moon } from "lucide-react";

import { useDarkMode } from "./use-dark-mode";

function ThemeToggle() {
  // 主题态订阅收口在 use-dark-mode(图表配色也读同一个源)
  const dark = useDarkMode();

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next); // MutationObserver 触发重渲染
    try {
      localStorage.setItem("cqs-theme", next ? "dark" : "light");
    } catch {
      /* 隐私模式禁写 localStorage:仅本次会话生效 */
    }
  }

  return (
    <button
      type="button"
      aria-label={dark ? "切换到浅色主题" : "切换到深色主题"}
      onClick={toggle}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Topbar() {
  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-border-light bg-topbar px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary"
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14l4.5-7L10 11l2.5-4L16 14H2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </span>
        <span className="text-base font-bold text-primary">长秋山森林公园智慧景区</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <button
          aria-label="全屏"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
          onClick={() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
          }}
        >
          <Maximize2 size={16} />
        </button>

        <button
          aria-label="通知"
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
        >
          <Bell size={16} />
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-white">
            3
          </span>
        </button>

        <button
          aria-label="帮助"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
        >
          <HelpCircle size={16} />
        </button>

        <span aria-hidden="true" className="inline-block h-5 w-px bg-border" />

        <button className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
            管
          </span>
          <span className="text-[13px] text-foreground">系统管理员</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
