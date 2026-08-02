import { useI18n } from '../i18n'
export function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh(): void }): React.JSX.Element { const {t}=useI18n(); return <button className="primary-button" disabled={refreshing} onClick={onRefresh} type="button">{refreshing?t('refreshing'):t('refreshNow')}</button> }
