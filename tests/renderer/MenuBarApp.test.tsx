/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RendererApi } from '../../src/shared/api'
import { MenuBarApp } from '../../src/renderer/src/MenuBarApp'

function api(): RendererApi { return { getToday: vi.fn(async()=>({ok:true,value:{summary:null,localDate:'2026-08-02',overall:{sessionCount:0,interactionCount:null,tokenUsage:null,activeDurationSeconds:null},providers:[],recentSessions:[],intensity:{status:'insufficient-data',comparison:'provisional',score:50,band:'normal',explanation:''}}})),refreshNow:vi.fn(async()=>({ok:true,value:{status:'complete',trigger:'manual',providers:0,succeeded:0,failed:0,inserted:0,updated:0,unchanged:0,warnings:0}})),getSettings:vi.fn(),updateSettings:vi.fn(),openClient:vi.fn(async()=>({ok:true,value:undefined})),onRefreshState:vi.fn(()=>()=>undefined)} }
afterEach(cleanup)
describe('MenuBarApp',()=>{it('shows empty state and opens the full client',async()=>{const bridge=api();window.tokenActivityShow=bridge;render(<MenuBarApp/>);expect(await screen.findByText('等待本地活动')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'打开完整活动'}));await waitFor(()=>expect(bridge.openClient).toHaveBeenCalledOnce())})})
