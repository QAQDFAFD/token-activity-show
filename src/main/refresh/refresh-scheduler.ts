const MINUTE_MS = 60_000

export class RefreshScheduler {
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(private readonly refresh: () => Promise<unknown>) {}

  start(intervalMinutes: number): void {
    this.reschedule(intervalMinutes)
  }

  reschedule(intervalMinutes: number): void {
    this.stop()
    if (intervalMinutes === 0) return

    this.timer = setInterval(() => {
      void this.refresh()
    }, intervalMinutes * MINUTE_MS)
  }

  stop(): void {
    if (this.timer === undefined) return
    clearInterval(this.timer)
    this.timer = undefined
  }
}
