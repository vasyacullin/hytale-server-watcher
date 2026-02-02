import { component$, useSignal, $, type PropFunction } from "@builder.io/qwik";
import { api } from "~/lib/api";
import type { BackupEntry } from "~/lib/types";

interface BackupsCardProps {
  backups: BackupEntry[];
  onRefresh$: PropFunction<() => void>;
}

export const BackupsCard = component$<BackupsCardProps>(({ backups, onRefresh$ }) => {
  const deleting = useSignal<string | null>(null);

  const handleDelete = $(async (filename: string) => {
    if (!confirm(`Delete backup ${filename}?`)) return;

    deleting.value = filename;
    try {
      await api.deleteBackup(filename);
      onRefresh$();
    } catch (e) {
      console.error("Failed to delete backup:", e);
    } finally {
      deleting.value = null;
    }
  });

  const handleDownload = $((filename: string) => {
    api.downloadBackup(filename);
  });

  return (
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 class="text-lg font-semibold">Backups</h2>
        <span class="text-sm text-[var(--color-text-muted)]">
          {backups.length} backup{backups.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto max-h-[300px]">
        {backups.length === 0 ? (
          <div class="text-[var(--color-text-muted)] text-center py-8">
            No backups yet
          </div>
        ) : (
          <div class="divide-y divide-[var(--color-border)]">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                class="flex items-center justify-between p-4 hover:bg-[var(--color-bg)]/50"
              >
                <div class="flex items-center gap-3">
                  <svg
                    class="w-8 h-8 text-[var(--color-primary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
                  </svg>
                  <div>
                    <div class="font-medium text-sm">{backup.filename}</div>
                    <div class="text-xs text-[var(--color-text-muted)]">
                      {backup.size} • {backup.created_at}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    class="p-2 rounded-lg hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] transition-colors"
                    onClick$={() => handleDownload(backup.filename)}
                    title="Download"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </button>

                  <button
                    class="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                    onClick$={() => handleDelete(backup.filename)}
                    disabled={deleting.value === backup.filename}
                    title="Delete"
                  >
                    {deleting.value === backup.filename ? (
                      <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        ></path>
                      </svg>
                    ) : (
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
