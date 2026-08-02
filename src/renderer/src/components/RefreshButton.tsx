export function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh(): void }): React.JSX.Element {
  return <button className="primary-button" disabled={refreshing} onClick={onRefresh} type="button">{refreshing ? '正在刷新…' : '立即刷新'}</button>
}
