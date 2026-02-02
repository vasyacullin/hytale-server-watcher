import { component$, useSignal, $, type PropFunction } from "@builder.io/qwik";
import { useLanguage } from "~/lib/i18n-context";
import { translations } from "~/lib/i18n";
import type { RemoteServer } from "~/lib/types";

interface AddServerModalProps {
  isOpen: boolean;
  onClose$: PropFunction<() => void>;
  onAdd$: PropFunction<(server: RemoteServer) => void>;
}

export const AddServerModal = component$<AddServerModalProps>(
  ({ isOpen, onClose$, onAdd$ }) => {
    const language = useLanguage();
    const t = (key: keyof typeof translations.en) =>
      translations[language.value][key] || translations.en[key];

    const name = useSignal("");
    const host = useSignal("");
    const port = useSignal("3000");
    const token = useSignal("");

    const handleSubmit = $(async () => {
      if (!name.value || !host.value) return;

      const server: RemoteServer = {
        id: crypto.randomUUID(),
        name: name.value,
        host: host.value,
        port: parseInt(port.value) || 3000,
        token: token.value || undefined,
      };

      await onAdd$(server);

      // Reset form
      name.value = "";
      host.value = "";
      port.value = "3000";
      token.value = "";
    });

    if (!isOpen) return null;

    return (
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick$={onClose$}
        ></div>

        {/* Modal */}
        <div class="relative bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-md mx-4 shadow-2xl">
          <h2 class="text-xl font-semibold mb-6">{t("addRemoteServer")}</h2>

          <form
            preventdefault:submit
            onSubmit$={handleSubmit}
            class="space-y-4"
          >
            <div>
              <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                {t("serverName")} *
              </label>
              <input
                type="text"
                value={name.value}
                onInput$={(e) => (name.value = (e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                placeholder="Production Server"
                required
              />
            </div>

            <div>
              <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                {t("serverHost")} *
              </label>
              <input
                type="text"
                value={host.value}
                onInput$={(e) => (host.value = (e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                placeholder="192.168.1.10"
                required
              />
            </div>

            <div>
              <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                {t("serverPort")}
              </label>
              <input
                type="number"
                value={port.value}
                onInput$={(e) => (port.value = (e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                placeholder="3000"
              />
            </div>

            <div>
              <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                {t("serverToken")}
              </label>
              <input
                type="password"
                value={token.value}
                onInput$={(e) => (token.value = (e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                placeholder="optional"
              />
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick$={onClose$}
                class="px-4 py-2 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                class="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-medium hover:bg-[var(--color-primary)]/80 transition-colors"
              >
                {t("add")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);
