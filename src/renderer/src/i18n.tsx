import { createContext, useContext } from 'react'

export type AppLocale = 'zh-CN' | 'zh-TW' | 'en'

const en = {
  localActivity: 'Activity on this Mac', todayNav: 'Today', settingsNav: 'Settings', localOnly: 'Data stays on this Mac', appearance: 'Appearance', system: 'System', light: 'Light', dark: 'Dark', mainNavigation: 'Main navigation',
  todayActivity: "Today's activity", localStatistics: 'Local statistics', coveredUntil: 'Covered until {time}', refreshNow: 'Refresh', refreshing: 'Refreshing…', loadingToday: "Loading today's activity…", loadFailed: 'Unable to load activity', retry: 'Retry', refreshFailed: 'Refresh incomplete', preservedData: '{message}. Last successful data is still shown.',
  waitingActivity: 'Waiting for local activity', waitingDescription: 'Session formats have not been established. The app only shows verified data and never guesses fields or records unknown values as zero.', sourceStatus: 'Source status', formatMissing: 'Format not established', currentStatus: 'Current status:', statisticsOnly: 'Statistics-only mode', statisticsNotice: 'Activity summaries will arrive with analysis-model support. This view only shows local, objective, verifiable statistics.',
  intensity: 'Today intensity', insufficient: 'Not enough history', preliminary: 'Preliminary', established: 'Baseline established', insufficientExplanation: 'At least 3 active days are needed to establish an initial baseline.', provisionalExplanation: 'Today is still in progress, so this comparison is provisional.', veryLow: 'Very low', low: 'Low', normal: 'Normal', high: 'High', veryHigh: 'Very high', provisional: 'Provisional', intensityA11y: 'Intensity score {score}, {band}',
  nativeSessions: 'Native sessions', effectiveInteractions: 'Effective interactions', tokenUsage: 'Token usage', activeDuration: 'Active duration', unavailable: 'Unavailable', seconds: '{value} sec', todaySummary: 'Today summary', sourceActivity: 'Source activity', activeSources: '{count} active sources', sessionsCount: '{count} native sessions', interactions: 'Interactions', tokens: 'Tokens', recentSessions: 'Recent sessions', upToTen: 'Up to 10', unnamedProject: 'Untitled project',
  preferences: 'Preferences', settings: 'Settings', settingsIntro: 'Manage local sources and refresh frequency while the app is open.', loadingSettings: 'Loading settings…', activitySources: 'Activity sources', sourcesHelp: 'Disabled sources are skipped by future refreshes.', enableProvider: 'Enable {provider}', claudeDescription: 'Anthropic local coding sessions', codexDescription: 'OpenAI Codex local sessions', hermesDescription: 'Nous Research Hermes Agent', automaticRefresh: 'Automatic refresh', automaticHelp: 'Automatic refresh only runs while Token Activity Show is open.', refreshInterval: 'Refresh interval', disableRefresh: 'Turn off automatic refresh', everyMinutes: 'Every {count} minutes', futureControls: 'Analysis model and privacy controls', futureHelp: 'Activity summaries, model configuration, and advanced privacy controls are planned.', planned: 'Planned', saveSettings: 'Save settings', saving: 'Saving…', saved: 'Settings saved'
} as const

type TranslationKey = keyof typeof en
type Dictionary = { [K in TranslationKey]: string }

const zhCN: Dictionary = {
  localActivity:'本机活动',todayNav:'今日',settingsNav:'设置',localOnly:'数据仅保存在本机',appearance:'外观',system:'系统',light:'日间',dark:'暗夜',mainNavigation:'主导航',todayActivity:'今日活动',localStatistics:'本地统计',coveredUntil:'数据覆盖至 {time}',refreshNow:'立即刷新',refreshing:'正在刷新…',loadingToday:'正在加载今日活动…',loadFailed:'无法加载活动',retry:'重试',refreshFailed:'刷新未完成',preservedData:'{message}，已保留上次成功的数据。',waitingActivity:'等待本地活动',waitingDescription:'会话格式尚未建立。应用只展示能够验证的数据，不会猜测字段或将未知值记为零。',sourceStatus:'来源状态',formatMissing:'格式尚未建立',currentStatus:'当前状态：',statisticsOnly:'仅统计模式',statisticsNotice:'活动摘要将在后续支持分析模型后生成。当前页面只展示本地、客观且可验证的统计数据。',intensity:'今日强度',insufficient:'历史数据不足',preliminary:'初步评估',established:'已建立基线',insufficientExplanation:'需要至少 3 个有效使用日才能建立初步基线。',provisionalExplanation:'当日尚未结束，当前强度比较为临时结果。',veryLow:'非常低',low:'偏低',normal:'正常',high:'偏高',veryHigh:'非常高',provisional:'临时',intensityA11y:'强度分数 {score}，{band}',nativeSessions:'原生会话',effectiveInteractions:'有效交互',tokenUsage:'Token 用量',activeDuration:'活跃时长',unavailable:'不可用',seconds:'{value} 秒',todaySummary:'今日汇总',sourceActivity:'来源活动',activeSources:'{count} 个活跃来源',sessionsCount:'{count} 个原生会话',interactions:'交互',tokens:'Token',recentSessions:'最近会话',upToTen:'最多显示 10 个',unnamedProject:'未命名项目',preferences:'偏好设置',settings:'设置',settingsIntro:'管理本地来源和应用运行期间的刷新频率。',loadingSettings:'正在加载设置…',activitySources:'活动来源',sourcesHelp:'关闭来源后，后续刷新将跳过该来源。',enableProvider:'启用 {provider}',claudeDescription:'Anthropic 本地编码会话',codexDescription:'OpenAI Codex 本地会话',hermesDescription:'Nous Research Hermes Agent',automaticRefresh:'自动刷新',automaticHelp:'自动刷新仅在 Token Activity Show 打开时运行。',refreshInterval:'刷新间隔',disableRefresh:'关闭自动刷新',everyMinutes:'每 {count} 分钟',futureControls:'分析模型与隐私控制',futureHelp:'活动摘要、模型配置和高级隐私控制将在后续版本提供。',planned:'计划中',saveSettings:'保存设置',saving:'正在保存…',saved:'设置已保存'
}
const zhTW: Dictionary = {
  ...zhCN, localActivity:'本機活動',todayNav:'今日',settingsNav:'設定',localOnly:'資料僅保存在本機',appearance:'外觀',system:'系統',light:'日間',dark:'暗夜',mainNavigation:'主導覽',todayActivity:'今日活動',localStatistics:'本機統計',coveredUntil:'資料涵蓋至 {time}',refreshNow:'立即重新整理',refreshing:'正在重新整理…',loadingToday:'正在載入今日活動…',loadFailed:'無法載入活動',refreshFailed:'重新整理未完成',preservedData:'{message}，已保留上次成功的資料。',waitingActivity:'等待本機活動',waitingDescription:'工作階段格式尚未建立。應用程式只顯示可驗證的資料，不會猜測欄位或將未知值記為零。',sourceStatus:'來源狀態',formatMissing:'格式尚未建立',currentStatus:'目前狀態：',statisticsOnly:'僅統計模式',statisticsNotice:'活動摘要將在後續支援分析模型後產生。目前頁面只顯示本機、客觀且可驗證的統計資料。',insufficient:'歷史資料不足',preliminary:'初步評估',established:'已建立基準',insufficientExplanation:'需要至少 3 個有效使用日才能建立初步基準。',provisionalExplanation:'今日尚未結束，目前強度比較為暫時結果。',provisional:'暫時',nativeSessions:'原生工作階段',effectiveInteractions:'有效互動',tokenUsage:'Token 用量',activeDuration:'活躍時間',unavailable:'無法使用',seconds:'{value} 秒',todaySummary:'今日摘要',sourceActivity:'來源活動',activeSources:'{count} 個活躍來源',sessionsCount:'{count} 個原生工作階段',interactions:'互動',recentSessions:'最近工作階段',upToTen:'最多顯示 10 個',unnamedProject:'未命名專案',preferences:'偏好設定',settings:'設定',settingsIntro:'管理本機來源和應用程式執行期間的重新整理頻率。',loadingSettings:'正在載入設定…',activitySources:'活動來源',sourcesHelp:'關閉來源後，後續重新整理將略過該來源。',enableProvider:'啟用 {provider}',claudeDescription:'Anthropic 本機編碼工作階段',codexDescription:'OpenAI Codex 本機工作階段',automaticRefresh:'自動重新整理',automaticHelp:'自動重新整理僅在 Token Activity Show 開啟時執行。',refreshInterval:'重新整理間隔',disableRefresh:'關閉自動重新整理',everyMinutes:'每 {count} 分鐘',futureControls:'分析模型與隱私控制',futureHelp:'活動摘要、模型設定和進階隱私控制將在後續版本提供。',planned:'規劃中',saveSettings:'儲存設定',saving:'正在儲存…',saved:'設定已儲存'
}
const dictionaries: Record<AppLocale, Dictionary> = { en, 'zh-CN': zhCN, 'zh-TW': zhTW }

export function resolveLocale(languages: readonly string[]): AppLocale {
  for (const raw of languages) {
    const locale = raw.toLowerCase()
    if (locale.startsWith('zh-hant') || /zh-(tw|hk|mo)/.test(locale)) return 'zh-TW'
    if (locale.startsWith('zh-hans') || /zh-(cn|sg)/.test(locale) || locale === 'zh') return 'zh-CN'
    if (locale.startsWith('en')) return 'en'
  }
  return 'en'
}

export interface I18n {
  locale: AppLocale
  t(key: TranslationKey, values?: Record<string, string | number>): string
  number(value: number): string
  time(value: Date): string
}

export function createI18n(locale = resolveLocale(navigator.languages)): I18n {
  return { locale, t: (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), dictionaries[locale][key]), number: (value) => new Intl.NumberFormat(locale).format(value), time: (value) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(value) }
}

const I18nContext = createContext<I18n>(createI18n('zh-CN'))
export const I18nProvider = I18nContext.Provider
export function useI18n(): I18n { return useContext(I18nContext) }
