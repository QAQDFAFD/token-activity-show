/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createI18n, resolveLocale } from '../../src/renderer/src/i18n'

describe('i18n',()=>{
 it('resolves simplified, traditional, and English fallback',()=>{expect(resolveLocale(['fr-FR','zh-CN'])).toBe('zh-CN');expect(resolveLocale(['zh-HK'])).toBe('zh-TW');expect(resolveLocale(['ja-JP'])).toBe('en')})
 it('translates and interpolates every supported locale',()=>{expect(createI18n('zh-CN').t('everyMinutes',{count:10})).toBe('每 10 分钟');expect(createI18n('zh-TW').t('settings')).toBe('設定');expect(createI18n('en').t('waitingActivity')).toBe('Waiting for local activity')})
 it('formats numbers with the selected locale',()=>{expect(createI18n('en').number(1234)).toContain('1,234');expect(createI18n('zh-CN').number(1234)).toContain('1,234')})
})
