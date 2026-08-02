import { beforeEach, describe, expect, it, vi } from 'vitest'
const { windows, FakeWindow } = vi.hoisted(()=>{
  class Window { events=new Map<string,()=>void>();visible=false;destroyed=false;webContents={isDevToolsOpened:()=>false,send:vi.fn()};options:Record<string,unknown>;constructor(options:Record<string,unknown>){this.options=options;instances.push(this)}on(name:string,fn:()=>void){this.events.set(name,fn)}loadURL=vi.fn();loadFile=vi.fn();isDestroyed=()=>this.destroyed;isMinimized=()=>false;restore=vi.fn();show=vi.fn(()=>{this.visible=true});focus=vi.fn();hide=vi.fn(()=>{this.visible=false});destroy=vi.fn(()=>{this.destroyed=true});getSize=()=>[360,520];setPosition=vi.fn();isVisible=()=>this.visible}
  const instances:Window[]=[]
  return {windows:instances,FakeWindow:Window}
})
vi.mock('electron',()=>({BrowserWindow:FakeWindow}))
import { createWindowController } from '../../../src/main/windows'
describe('WindowController',()=>{beforeEach(()=>windows.splice(0));it('reuses the full client and toggles one popover',()=>{const controller=createWindowController();controller.showClient();controller.showClient();expect(windows).toHaveLength(1);controller.toggleMenuBar({x:100,y:10,width:20,height:20});expect(windows).toHaveLength(2);expect(windows[1]?.setPosition).toHaveBeenCalled();controller.toggleMenuBar({x:100,y:10,width:20,height:20});expect(windows[1]?.hide).toHaveBeenCalled();controller.dispose();expect(windows.every(w=>w.destroyed)).toBe(true)})})
