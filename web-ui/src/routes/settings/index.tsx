import { component$, useSignal, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useLanguageProvider } from "~/lib/i18n-context";
import { type Language, translations, setStoredLanguage } from "~/lib/i18n";
import { api } from "~/lib/api";

interface Config {
  server: {
    executable: string;
    arguments: string[];
    working_directory: string | null;
    restart_delay_seconds: number;
    max_restarts: number | null;
    auto_restart_hourly: boolean;
    restart_warning_message: string;
  };
  telegram: {
    enabled: boolean;
    token: string;
    chat_id: string;
  };
  resources: {
    cpu_threshold_percent: number;
    memory_threshold_mb: number;
    check_interval_seconds: number;
  };
  error_patterns: {
    critical: string[];
    errors: string[];
    warnings: string[];
  };
  restart_on: {
    critical: boolean;
    errors: boolean;
    warnings: boolean;
    process_exit: boolean;
  };
  backup: {
    enabled: boolean;
    source_folder: string;
    backup_folder: string;
    interval_hours: number;
    retention_days: number;
  };
  log_cleanup: {
    enabled: boolean;
    log_folder: string;
    retention_hours: number;
    check_interval_hours: number;
  };
}

const defaultConfig: Config = {
  server: {
    executable: "java",
    arguments: ["-Xms4G", "-Xmx8G", "-jar", "server.jar"],
    working_directory: null,
    restart_delay_seconds: 30,
    max_restarts: null,
    auto_restart_hourly: false,
    restart_warning_message: "Server will restart in 1 minute!",
  },
  telegram: {
    enabled: false,
    token: "",
    chat_id: "",
  },
  resources: {
    cpu_threshold_percent: 90,
    memory_threshold_mb: 4096,
    check_interval_seconds: 5,
  },
  error_patterns: {
    critical: ["FATAL", "Server crashed", "OutOfMemoryError"],
    errors: ["ERROR", "Exception"],
    warnings: ["WARN", "Warning"],
  },
  restart_on: {
    critical: true,
    errors: false,
    warnings: false,
    process_exit: true,
  },
  backup: {
    enabled: true,
    source_folder: "universe",
    backup_folder: "backups",
    interval_hours: 4,
    retention_days: 10,
  },
  log_cleanup: {
    enabled: true,
    log_folder: "logs",
    retention_hours: 24,
    check_interval_hours: 1,
  },
};

export default component$(() => {
  const language = useLanguageProvider();
  const activeTab = useSignal<"general" | "backup" | "telegram" | "advanced" | "about">("general");
  const t = (key: keyof typeof translations.en) =>
    translations[language.value][key] || translations.en[key];

  const config = useStore<Config>(structuredClone(defaultConfig));
  const loading = useSignal(true);
  const saving = useSignal(false);
  const message = useSignal<{ type: "success" | "error"; text: string } | null>(null);

  // Temp fields for array inputs
  const argumentsText = useSignal("");
  const criticalPatternsText = useSignal("");
  const errorPatternsText = useSignal("");
  const warningPatternsText = useSignal("");

  const handleLanguageChange = $((lang: Language) => {
    language.value = lang;
    setStoredLanguage(lang);
  });

  // Load config on mount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const loadedConfig = await api.getConfig() as Config;

      // Update store
      Object.assign(config.server, loadedConfig.server);
      Object.assign(config.telegram, loadedConfig.telegram);
      Object.assign(config.resources, loadedConfig.resources);
      Object.assign(config.error_patterns, loadedConfig.error_patterns);
      Object.assign(config.restart_on, loadedConfig.restart_on);
      Object.assign(config.backup, loadedConfig.backup);
      if (loadedConfig.log_cleanup) {
        Object.assign(config.log_cleanup, loadedConfig.log_cleanup);
      }

      // Set text fields
      argumentsText.value = config.server.arguments.join(" ");
      criticalPatternsText.value = config.error_patterns.critical.join(", ");
      errorPatternsText.value = config.error_patterns.errors.join(", ");
      warningPatternsText.value = config.error_patterns.warnings.join(", ");
    } catch (e) {
      console.error("Failed to load config:", e);
      const errorText = translations[language.value].configLoadError || translations.en.configLoadError;
      message.value = { type: "error", text: errorText };
    } finally {
      loading.value = false;
    }
  });

  const saveConfig = $(async () => {
    saving.value = true;
    message.value = null;

    try {
      // Parse text fields back to arrays
      config.server.arguments = argumentsText.value.split(/\s+/).filter(Boolean);
      config.error_patterns.critical = criticalPatternsText.value.split(",").map(s => s.trim()).filter(Boolean);
      config.error_patterns.errors = errorPatternsText.value.split(",").map(s => s.trim()).filter(Boolean);
      config.error_patterns.warnings = warningPatternsText.value.split(",").map(s => s.trim()).filter(Boolean);

      await api.updateConfig(config);
      const successText = translations[language.value].configSaved || translations.en.configSaved;
      message.value = { type: "success", text: successText };
    } catch (e) {
      console.error("Failed to save config:", e);
      const errorText = translations[language.value].configSaveError || translations.en.configSaveError;
      message.value = { type: "error", text: errorText };
    } finally {
      saving.value = false;
    }
  });

  if (loading.value) {
    return (
      <div class="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div class="text-[var(--color-text-muted)]">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header class="sticky top-0 z-10 bg-[var(--color-bg)]/80 backdrop-blur border-b border-[var(--color-border)] px-6 py-4">
        <div class="flex items-center gap-4">
          <a
            href="/"
            class="p-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 class="text-2xl font-bold">{t("settings")}</h1>
        </div>
      </header>

      {/* Message */}
      {message.value && (
        <div class={`mx-6 mt-4 px-4 py-3 rounded-lg ${
          message.value.type === "success"
            ? "bg-green-500/20 border border-green-500/50 text-green-400"
            : "bg-red-500/20 border border-red-500/50 text-red-400"
        }`}>
          {message.value.text}
        </div>
      )}

      <div class="flex">
        {/* Tabs */}
        <nav class="w-48 p-4 border-r border-[var(--color-border)]">
          <div class="space-y-1">
            {(["general", "backup", "telegram", "advanced", "about"] as const).map((tab) => (
              <button
                key={tab}
                class={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activeTab.value === tab
                    ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                    : "hover:bg-[var(--color-surface)]"
                }`}
                onClick$={() => (activeTab.value = tab)}
              >
                {tab === "advanced" ? (language.value === "ru" ? "Расширенные" : "Advanced") : t(tab as keyof typeof translations.en)}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main class="flex-1 p-6 max-w-2xl">
          {/* General Tab */}
          {activeTab.value === "general" && (
            <div class="space-y-6">
              <h2 class="text-xl font-semibold">{t("general")}</h2>

              {/* Language */}
              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <h3 class="font-medium mb-4">{t("language")}</h3>
                <div class="flex gap-3">
                  <button
                    class={`px-4 py-2 rounded-lg transition-colors ${
                      language.value === "en"
                        ? "bg-[var(--color-primary)] text-black"
                        : "bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)]"
                    }`}
                    onClick$={() => handleLanguageChange("en")}
                  >
                    {t("english")}
                  </button>
                  <button
                    class={`px-4 py-2 rounded-lg transition-colors ${
                      language.value === "ru"
                        ? "bg-[var(--color-primary)] text-black"
                        : "bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)]"
                    }`}
                    onClick$={() => handleLanguageChange("ru")}
                  >
                    {t("russian")}
                  </button>
                </div>
              </div>

              {/* Server Settings */}
              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <h3 class="font-medium mb-4">{t("serverSettings")}</h3>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("executable")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.server.executable}
                      onInput$={(e) => (config.server.executable = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("arguments")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={argumentsText.value}
                      onInput$={(e) => (argumentsText.value = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("workingDirectory")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.server.working_directory || ""}
                      onInput$={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        config.server.working_directory = val || null;
                      }}
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("restartDelay")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.server.restart_delay_seconds}
                        onInput$={(e) => (config.server.restart_delay_seconds = parseInt((e.target as HTMLInputElement).value) || 30)}
                      />
                    </div>
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("maxRestarts")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        placeholder={t("unlimited")}
                        value={config.server.max_restarts ?? ""}
                        onInput$={(e) => {
                          const val = (e.target as HTMLInputElement).value;
                          config.server.max_restarts = val ? parseInt(val) : null;
                        }}
                      />
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("autoRestartHourly")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.server.auto_restart_hourly
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.server.auto_restart_hourly = !config.server.auto_restart_hourly)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.server.auto_restart_hourly
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("restartWarningMessage")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.server.restart_warning_message}
                      onInput$={(e) => (config.server.restart_warning_message = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Backup Tab */}
          {activeTab.value === "backup" && (
            <div class="space-y-6">
              <h2 class="text-xl font-semibold">{t("backupSettings")}</h2>

              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("backupEnabled")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.backup.enabled
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.backup.enabled = !config.backup.enabled)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.backup.enabled
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("sourceFolder")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.backup.source_folder}
                      onInput$={(e) => (config.backup.source_folder = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("backupFolder")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.backup.backup_folder}
                      onInput$={(e) => (config.backup.backup_folder = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("intervalHours")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.backup.interval_hours}
                        onInput$={(e) => (config.backup.interval_hours = parseInt((e.target as HTMLInputElement).value) || 4)}
                      />
                    </div>
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("retentionDays")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.backup.retention_days}
                        onInput$={(e) => (config.backup.retention_days = parseInt((e.target as HTMLInputElement).value) || 10)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Log Cleanup */}
              <h2 class="text-xl font-semibold">{t("logCleanup")}</h2>
              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("logCleanupEnabled")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.log_cleanup.enabled
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.log_cleanup.enabled = !config.log_cleanup.enabled)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.log_cleanup.enabled
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("logFolder")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.log_cleanup.log_folder}
                      onInput$={(e) => (config.log_cleanup.log_folder = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("logRetentionHours")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.log_cleanup.retention_hours}
                        onInput$={(e) => (config.log_cleanup.retention_hours = parseInt((e.target as HTMLInputElement).value) || 24)}
                      />
                    </div>
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("logCheckInterval")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.log_cleanup.check_interval_hours}
                        onInput$={(e) => (config.log_cleanup.check_interval_hours = parseInt((e.target as HTMLInputElement).value) || 1)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Telegram Tab */}
          {activeTab.value === "telegram" && (
            <div class="space-y-6">
              <h2 class="text-xl font-semibold">{t("telegramSettings")}</h2>

              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("telegramEnabled")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.telegram.enabled
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.telegram.enabled = !config.telegram.enabled)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.telegram.enabled
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("botToken")}
                    </label>
                    <input
                      type="password"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.telegram.token}
                      onInput$={(e) => (config.telegram.token = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("chatId")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={config.telegram.chat_id}
                      onInput$={(e) => (config.telegram.chat_id = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab.value === "advanced" && (
            <div class="space-y-6">
              <h2 class="text-xl font-semibold">{t("resourcesSettings")}</h2>

              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="space-y-4">
                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("cpuThreshold")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.resources.cpu_threshold_percent}
                        onInput$={(e) => (config.resources.cpu_threshold_percent = parseFloat((e.target as HTMLInputElement).value) || 90)}
                      />
                    </div>
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("memoryThreshold")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.resources.memory_threshold_mb}
                        onInput$={(e) => (config.resources.memory_threshold_mb = parseInt((e.target as HTMLInputElement).value) || 4096)}
                      />
                    </div>
                    <div>
                      <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                        {t("checkInterval")}
                      </label>
                      <input
                        type="number"
                        class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                        value={config.resources.check_interval_seconds}
                        onInput$={(e) => (config.resources.check_interval_seconds = parseInt((e.target as HTMLInputElement).value) || 5)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <h2 class="text-xl font-semibold">{t("errorPatterns")}</h2>
              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("criticalPatterns")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={criticalPatternsText.value}
                      onInput$={(e) => (criticalPatternsText.value = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("errorPatternsField")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={errorPatternsText.value}
                      onInput$={(e) => (errorPatternsText.value = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-[var(--color-text-muted)] mb-1">
                      {t("warningPatterns")}
                    </label>
                    <input
                      type="text"
                      class="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none"
                      value={warningPatternsText.value}
                      onInput$={(e) => (warningPatternsText.value = (e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>
              </div>

              <h2 class="text-xl font-semibold">{t("restartOn")}</h2>
              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("restartOnCritical")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.restart_on.critical
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.restart_on.critical = !config.restart_on.critical)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.restart_on.critical
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("restartOnErrors")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.restart_on.errors
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.restart_on.errors = !config.restart_on.errors)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.restart_on.errors
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("restartOnWarnings")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.restart_on.warnings
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.restart_on.warnings = !config.restart_on.warnings)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.restart_on.warnings
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                  <div class="flex items-center justify-between">
                    <label class="font-medium">{t("restartOnProcessExit")}</label>
                    <button
                      class={`w-12 h-6 rounded-full relative transition-colors ${
                        config.restart_on.process_exit
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}
                      onClick$={() => (config.restart_on.process_exit = !config.restart_on.process_exit)}
                    >
                      <span class={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                        config.restart_on.process_exit
                          ? "right-1 bg-white"
                          : "left-1 bg-[var(--color-text-muted)]"
                      }`}></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab.value === "about" && (
            <div class="space-y-6">
              <h2 class="text-xl font-semibold">{t("about")}</h2>

              <div class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
                <div class="text-center">
                  <h3 class="text-2xl font-bold text-[var(--color-primary)] mb-2">
                    Server Watcher
                  </h3>
                  <p class="text-[var(--color-text-muted)] mb-4">v0.4.0</p>
                  <p class="text-sm text-[var(--color-text-muted)]">
                    A powerful server monitoring and management tool
                  </p>
                  <div class="mt-6 flex justify-center gap-4">
                    <a
                      href="https://github.com"
                      target="_blank"
                      class="text-[var(--color-primary)] hover:underline"
                    >
                      GitHub
                    </a>
                    <a
                      href="#"
                      class="text-[var(--color-primary)] hover:underline"
                    >
                      Documentation
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          {activeTab.value !== "about" && (
            <div class="mt-6 flex justify-end gap-3">
              <a
                href="/"
                class="px-4 py-2 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                {t("cancel")}
              </a>
              <button
                class="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-medium hover:bg-[var(--color-primary)]/80 transition-colors disabled:opacity-50"
                onClick$={saveConfig}
                disabled={saving.value}
              >
                {saving.value ? t("loading") : t("save")}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Settings - Server Watcher",
};
