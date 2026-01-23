import EventEmitter from 'events'

export class TransportStatistic extends EventEmitter<{
  change: [bps: number]
}> {
  sum: number // 5s

  constructor() {
    super()

    this.sum = 0
  }

  add(size: number) {
    this.sum += size
    this.emit('change', this.sum / 5)
    setTimeout(() => {
      this.sum -= size
      this.emit('change', this.sum / 5)
    }, 5000)
  }
}
