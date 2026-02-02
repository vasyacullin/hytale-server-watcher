export type Language = "en" | "ru";

export const translations = {
  en: {
    // App
    appName: "Server Watcher",
    dashboard: "Dashboard",
    settings: "Settings",

    // Sidebar
    servers: "Servers",
    local: "Local",
    addServer: "Add Server",

    // Status
    serverStatus: "Server Status",
    status: "Status",
    pid: "PID",
    uptime: "Uptime",
    restarts: "Restarts",
    autoRestart: "Auto-Restart",
    nextBackup: "Next backup in",

    // Status values
    running: "Running",
    starting: "Starting",
    stopping: "Stopping",
    stopped: "Stopped",
    restarting: "Restarting",
    error: "Error",

    // Resources
    resources: "Resources",
    cpu: "CPU",
    memory: "Memory",
    download: "Download",
    upload: "Upload",

    // Logs
    logs: "Logs",
    autoScroll: "Auto-scroll",
    noLogs: "No logs yet...",

    // Actions
    actions: "Actions",
    restart: "Restart",
    stop: "Stop",
    restartCommandSent: "Restart command sent",
    stopCommandSent: "Stop command sent",

    // Backups
    backups: "Backups",
    noBackups: "No backups yet",
    deleteBackup: "Delete backup",
    downloadBackup: "Download",
    confirmDelete: "Delete backup {filename}?",

    // Connection
    connected: "Connected",
    disconnected: "Disconnected",

    // Settings page
    language: "Language",
    english: "English",
    russian: "Russian",
    general: "General",
    backup: "Backup",
    telegram: "Telegram",
    about: "About",
    save: "Save",
    cancel: "Cancel",

    // Settings - Server
    serverSettings: "Server Settings",
    executable: "Executable",
    arguments: "Arguments",
    workingDirectory: "Working Directory",
    restartDelay: "Restart Delay (seconds)",
    maxRestarts: "Max Restarts",
    autoRestartHourly: "Auto-restart hourly",
    restartWarningMessage: "Restart Warning Message",

    // Settings - Backup
    backupSettings: "Backup Settings",
    backupEnabled: "Enable backups",
    sourceFolder: "Source Folder",
    backupFolder: "Backup Folder",
    intervalHours: "Interval (hours)",
    retentionDays: "Retention (days)",

    // Settings - Telegram
    telegramSettings: "Telegram Settings",
    telegramEnabled: "Enable Telegram",
    botToken: "Bot Token",
    chatId: "Chat ID",

    // Settings - Web
    webSettings: "Web Settings",
    webEnabled: "Enable Web UI",
    port: "Port",
    host: "Host",
    authToken: "Auth Token",

    // Add Server Modal
    addRemoteServer: "Add Remote Server",
    serverName: "Server Name",
    serverHost: "Host",
    serverPort: "Port",
    serverToken: "Token (optional)",
    add: "Add",

    // Common
    on: "ON",
    off: "OFF",
    enabled: "Enabled",
    disabled: "Disabled",
    loading: "Loading...",
    error_generic: "An error occurred",

    // Time
    hours: "h",
    minutes: "m",
    seconds: "s",

    // Settings - Resources
    resourcesSettings: "Resource Monitoring",
    cpuThreshold: "CPU Threshold (%)",
    memoryThreshold: "Memory Threshold (MB)",
    checkInterval: "Check Interval (seconds)",

    // Settings - Error Patterns
    errorPatterns: "Error Patterns",
    criticalPatterns: "Critical (comma-separated)",
    errorPatternsField: "Errors (comma-separated)",
    warningPatterns: "Warnings (comma-separated)",

    // Settings - Restart On
    restartOn: "Restart Triggers",
    restartOnCritical: "Restart on Critical",
    restartOnErrors: "Restart on Errors",
    restartOnWarnings: "Restart on Warnings",
    restartOnProcessExit: "Restart on Process Exit",

    // Settings - Log Cleanup
    logCleanup: "Log Cleanup",
    logCleanupEnabled: "Enable log cleanup",
    logFolder: "Log Folder",
    logRetentionHours: "Retention (hours)",
    logCheckInterval: "Check Interval (hours)",

    // Settings misc
    unlimited: "unlimited",
    configSaved: "Configuration saved",
    configSaveError: "Failed to save configuration",
    configLoadError: "Failed to load configuration",
    restartRequired: "Restart required for some changes",
  },

  ru: {
    // App
    appName: "Server Watcher",
    dashboard: "Панель",
    settings: "Настройки",

    // Sidebar
    servers: "Серверы",
    local: "Локальный",
    addServer: "Добавить сервер",

    // Status
    serverStatus: "Статус сервера",
    status: "Статус",
    pid: "PID",
    uptime: "Время работы",
    restarts: "Перезапуски",
    autoRestart: "Авто-рестарт",
    nextBackup: "Следующий бекап через",

    // Status values
    running: "Работает",
    starting: "Запускается",
    stopping: "Останавливается",
    stopped: "Остановлен",
    restarting: "Перезапускается",
    error: "Ошибка",

    // Resources
    resources: "Ресурсы",
    cpu: "CPU",
    memory: "Память",
    download: "Загрузка",
    upload: "Отдача",

    // Logs
    logs: "Логи",
    autoScroll: "Авто-прокрутка",
    noLogs: "Логов пока нет...",

    // Actions
    actions: "Действия",
    restart: "Перезапуск",
    stop: "Остановить",
    restartCommandSent: "Команда перезапуска отправлена",
    stopCommandSent: "Команда остановки отправлена",

    // Backups
    backups: "Бекапы",
    noBackups: "Бекапов пока нет",
    deleteBackup: "Удалить бекап",
    downloadBackup: "Скачать",
    confirmDelete: "Удалить бекап {filename}?",

    // Connection
    connected: "Подключено",
    disconnected: "Отключено",

    // Settings page
    language: "Язык",
    english: "Английский",
    russian: "Русский",
    general: "Основные",
    backup: "Бекапы",
    telegram: "Telegram",
    about: "О программе",
    save: "Сохранить",
    cancel: "Отмена",

    // Settings - Server
    serverSettings: "Настройки сервера",
    executable: "Исполняемый файл",
    arguments: "Аргументы",
    workingDirectory: "Рабочая директория",
    restartDelay: "Задержка перезапуска (сек)",
    maxRestarts: "Макс. перезапусков",
    autoRestartHourly: "Авто-рестарт каждый час",
    restartWarningMessage: "Сообщение предупреждения",

    // Settings - Backup
    backupSettings: "Настройки бекапов",
    backupEnabled: "Включить бекапы",
    sourceFolder: "Исходная папка",
    backupFolder: "Папка бекапов",
    intervalHours: "Интервал (часы)",
    retentionDays: "Хранение (дни)",

    // Settings - Telegram
    telegramSettings: "Настройки Telegram",
    telegramEnabled: "Включить Telegram",
    botToken: "Токен бота",
    chatId: "ID чата",

    // Settings - Web
    webSettings: "Настройки веб-интерфейса",
    webEnabled: "Включить веб-интерфейс",
    port: "Порт",
    host: "Хост",
    authToken: "Токен авторизации",

    // Add Server Modal
    addRemoteServer: "Добавить удалённый сервер",
    serverName: "Название сервера",
    serverHost: "Хост",
    serverPort: "Порт",
    serverToken: "Токен (опционально)",
    add: "Добавить",

    // Common
    on: "ВКЛ",
    off: "ВЫКЛ",
    enabled: "Включено",
    disabled: "Отключено",
    loading: "Загрузка...",
    error_generic: "Произошла ошибка",

    // Time
    hours: "ч",
    minutes: "м",
    seconds: "с",

    // Settings - Resources
    resourcesSettings: "Мониторинг ресурсов",
    cpuThreshold: "Порог CPU (%)",
    memoryThreshold: "Порог памяти (МБ)",
    checkInterval: "Интервал проверки (сек)",

    // Settings - Error Patterns
    errorPatterns: "Шаблоны ошибок",
    criticalPatterns: "Критические (через запятую)",
    errorPatternsField: "Ошибки (через запятую)",
    warningPatterns: "Предупреждения (через запятую)",

    // Settings - Restart On
    restartOn: "Триггеры перезапуска",
    restartOnCritical: "Перезапуск при критических",
    restartOnErrors: "Перезапуск при ошибках",
    restartOnWarnings: "Перезапуск при предупреждениях",
    restartOnProcessExit: "Перезапуск при завершении процесса",

    // Settings - Log Cleanup
    logCleanup: "Очистка логов",
    logCleanupEnabled: "Включить очистку логов",
    logFolder: "Папка логов",
    logRetentionHours: "Хранение (часы)",
    logCheckInterval: "Интервал проверки (часы)",

    // Settings misc
    unlimited: "неограничено",
    configSaved: "Конфигурация сохранена",
    configSaveError: "Ошибка сохранения конфигурации",
    configLoadError: "Ошибка загрузки конфигурации",
    restartRequired: "Для некоторых изменений требуется перезапуск",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(lang: Language, key: TranslationKey): string {
  return translations[lang][key] || translations.en[key] || key;
}

export function getStoredLanguage(): Language {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("language");
    if (stored === "en" || stored === "ru") {
      return stored;
    }
  }
  return "en";
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("language", lang);
  }
}
