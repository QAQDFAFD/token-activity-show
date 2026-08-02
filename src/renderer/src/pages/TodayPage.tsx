import { useCallback, useEffect, useState } from 'react'
import type { RefreshState, TodayViewModel } from '../../../shared/api'
import { getRendererApi } from '../api'
import { EmptyState } from '../components/EmptyState'
import { IntensityHeader } from '../components/IntensityHeader'
import { ProviderActivityList } from '../components/ProviderActivityList'
import { RecentSessions } from '../components/RecentSessions'
import { RefreshButton } from '../components/RefreshButton'
import { useI18n } from '../i18n'
function todayInput(){const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));return{localDate:`${values['year']}-${values['month']}-${values['day']}`,timeZone}}
export function TodayPage(): React.JSX.Element {
 const {t,number,time}=useI18n(); const [today,setToday]=useState<TodayViewModel|null>(null);const[error,setError]=useState<string|null>(null);const[loading,setLoading]=useState(true);const[refreshState,setRefreshState]=useState<RefreshState>({status:'idle'});
 const load=useCallback(async()=>{const r=await getRendererApi().getToday(todayInput());if(r.ok){setToday(r.value);setError(null)}else setError(r.error.message);setLoading(false)},[])
 useEffect(()=>{void getRendererApi().getToday(todayInput()).then(r=>{if(r.ok){setToday(r.value);setError(null)}else setError(r.error.message);setLoading(false)});return getRendererApi().onRefreshState(setRefreshState)},[])
 const refresh=async()=>{setRefreshState({status:'scanning'});const r=await getRendererApi().refreshNow();if(!r.ok||r.value.status==='failed'){setError(!r.ok?r.error.message:r.value.status==='failed'?r.value.reason:t('refreshFailed'));setRefreshState({status:'failed'});return}await load()}
 if(loading)return <div className="page-state" role="status"><div className="skeleton skeleton-title"/><div className="skeleton skeleton-card"/><span>{t('loadingToday')}</span></div>
 if(!today)return <div className="page-state"><h1>{t('loadFailed')}</h1><p>{error}</p><button className="primary-button" onClick={()=>void load()} type="button">{t('retry')}</button></div>
 const overall=today.overall, providers=today.providers??[];const metric=(v:number|null|undefined)=>v==null?t('unavailable'):number(v)
 return <div className="page-content"><header className="page-header"><div><p className="section-label">{today.localDate??t('todayNav')}</p><h1>{t('todayActivity')}</h1><p>{today.coveredAt?t('coveredUntil',{time:time(new Date(today.coveredAt))}):t('localStatistics')}</p></div><RefreshButton refreshing={refreshState.status==='scanning'} onRefresh={()=>void refresh()}/></header>{error&&<div className="error-banner" role="alert"><strong>{t('refreshFailed')}</strong><span>{t('preservedData',{message:error})}</span></div>}{overall&&overall.sessionCount>0&&today.intensity?<><IntensityHeader intensity={today.intensity}/><section className="metric-grid" aria-label={t('todaySummary')}><article><span>{t('nativeSessions')}</span><strong>{number(overall.sessionCount)}</strong></article><article><span>{t('effectiveInteractions')}</span><strong>{metric(overall.interactionCount)}</strong></article><article><span>{t('tokenUsage')}</span><strong>{metric(overall.tokenUsage)}</strong></article><article><span>{t('activeDuration')}</span><strong>{overall.activeDurationSeconds==null?t('unavailable'):t('seconds',{value:number(overall.activeDurationSeconds)})}</strong></article></section><ProviderActivityList providers={providers}/><RecentSessions sessions={today.recentSessions??[]}/></>:<EmptyState/>}<aside className="notice"><strong>{t('statisticsOnly')}</strong><p>{t('statisticsNotice')}</p></aside></div>
}
