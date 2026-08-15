/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CompletedRefreshReport, RefreshReport, RendererApi, TodayViewModel } from '../../src/shared/api'
import { TodayPage } from '../../src/renderer/src/pages/TodayPage'

const today: TodayViewModel = { summary:null,localDate:'2026-08-02',overall:{sessionCount:2,interactionCount:null,tokenUsage:null,activeDurationSeconds:null},providers:[],recentSessions:[],intensity:{status:'insufficient-data',comparison:'provisional',score:50,band:'normal',explanation:'需要至少 3 个有效使用日才能建立初步基线。'} }
const complete=(overrides:Partial<CompletedRefreshReport>={}):CompletedRefreshReport=>({status:'complete',trigger:'manual',providers:1,succeeded:1,failed:0,inserted:0,updated:0,unchanged:2,warnings:0,providerResults:[{providerId:'claude-code',status:'succeeded',inserted:0,updated:0,unchanged:2,warningCodes:[]}],...overrides})
function api(report:RefreshReport=complete(),overrides:Partial<RendererApi>={}):RendererApi{return{getToday:vi.fn(async()=>({ok:true,value:today})),refreshNow:vi.fn(async()=>({ok:true,value:report})),getSettings:vi.fn(),updateSettings:vi.fn(),openClient:vi.fn(async()=>({ok:true,value:undefined})),onRefreshState:vi.fn(()=>()=>undefined),...overrides}}
afterEach(cleanup)

async function refreshAndExpect(report:RefreshReport,text:RegExp){const bridge=api(report);window.tokenActivityShow=bridge;render(<TodayPage/>);await screen.findByText('历史数据不足');fireEvent.click(screen.getByRole('button',{name:'立即刷新'}));const feedback=(await screen.findByText(text)).closest('.refresh-feedback');expect(feedback).not.toBeNull();expect(bridge.getToday).toHaveBeenCalledTimes(2)}

describe('TodayPage',()=>{
 it('renders objective counts and unavailable metrics',async()=>{window.tokenActivityShow=api();render(<TodayPage/>);expect(await screen.findByText('历史数据不足')).toBeTruthy();expect(screen.getByText('2')).toBeTruthy();expect(screen.getAllByText('不可用').length).toBeGreaterThan(2)})
 it.each([
  [complete(),/没有变更/],
  [complete({inserted:1,unchanged:1,providerResults:[{providerId:'claude-code',status:'succeeded',inserted:1,updated:0,unchanged:1,warningCodes:[]}]}),/1 项变更/],
  [complete({succeeded:0,providerResults:[{providerId:'claude-code',status:'unsupported',inserted:0,updated:0,unchanged:0,warningCodes:['FORMAT_NOT_ESTABLISHED']}]}),/格式暂不支持/],
  [{status:'skipped',reason:'already-running'} as RefreshReport,/已跳过/],
  [complete({failed:1,succeeded:0,providerResults:[{providerId:'claude-code',status:'failed',inserted:0,updated:0,unchanged:0,warningCodes:[]}]}),/部分来源刷新失败/],
  [{status:'failed',trigger:'manual',reason:'private path'} as RefreshReport,/刷新失败/]
 ])('reports refresh outcome and always refetches %#',refreshAndExpect)
 it('refetches and restores the button after a thrown bridge error',async()=>{const bridge=api(complete(),{refreshNow:vi.fn(async()=>{throw new Error('/private/path')})});window.tokenActivityShow=bridge;render(<TodayPage/>);await screen.findByText('历史数据不足');fireEvent.click(screen.getByRole('button',{name:'立即刷新'}));const alert=(await screen.findByRole('alert'));expect(alert.textContent).toContain('刷新失败');expect(alert.className).toContain('refresh-feedback');await waitFor(()=>expect(bridge.getToday).toHaveBeenCalledTimes(2));expect((screen.getByRole('button',{name:'立即刷新'}) as HTMLButtonElement).disabled).toBe(false);expect(document.body.textContent).not.toContain('/private/path')})
})
