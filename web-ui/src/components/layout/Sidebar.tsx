import { component$, type PropFunction } from "@builder.io/qwik";
import { useLanguage } from "~/lib/i18n-context";
import { translations } from "~/lib/i18n";
import type { RemoteServer } from "~/lib/types";

interface SidebarProps {
  servers: RemoteServer[];
  activeServerId: string | null;
  onServerSelect$: PropFunction<(id: string | null) => void>;
  onAddServer$: PropFunction<() => void>;
}

export const Sidebar = component$<SidebarProps>(
  ({ servers, activeServerId, onServerSelect$, onAddServer$ }) => {
    const language = useLanguage();
    const t = (key: keyof typeof translations.en) =>
      translations[language.value][key] || translations.en[key];

    return (
      <aside class="hidden lg:flex w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex-col h-screen">
        {/* Logo */}
        <div class="p-4 border-b border-[var(--color-border)]">
          <h1 class="text-xl font-bold text-[var(--color-primary)] flex items-center gap-2">
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
            {t("appName")}
          </h1>
        </div>

        {/* Servers List */}
        <div class="flex-1 overflow-y-auto p-4">
          <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2">
            {t("servers")}
          </h2>

          <div class="space-y-1">
            {/* Local server */}
            <button
              class={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeServerId === null
                  ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                  : "hover:bg-[var(--color-surface-hover)]"
              }`}
              onClick$={() => onServerSelect$(null)}
            >
              <span class="w-2 h-2 rounded-full bg-[var(--color-primary)]"></span>
              <span>{t("local")}</span>
            </button>

            {/* Remote servers */}
            {servers.map((server) => (
              <button
                key={server.id}
                class={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  activeServerId === server.id
                    ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                    : "hover:bg-[var(--color-surface-hover)]"
                }`}
                onClick$={() => onServerSelect$(server.id)}
              >
                <span class="w-2 h-2 rounded-full bg-[var(--color-text-muted)]"></span>
                <span>{server.name}</span>
              </button>
            ))}
          </div>

          {/* Add Server Button */}
          <button
            onClick$={onAddServer$}
            class="w-full mt-4 px-3 py-2 border border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {t("addServer")}
          </button>
        </div>

        {/* Settings Link */}
        <div class="p-4 border-t border-[var(--color-border)]">
          <a
            href="/settings"
            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-muted)]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {t("settings")}
          </a>
        </div>
      </aside>
    );
  }
);
