export class Pos {
  x: number = 0
  y: number = 0

  set(x: number, y: number) {
    this.x = x
    this.y = y
    return this
  }

  static from(x: number, y: number) {
    return new Pos().set(x, y)
  }

  static fromEvent(ev: MouseEvent) {
    return Pos.from(ev.offsetX, ev.offsetY)
  }

  static is(x: unknown): x is Pos {
    return x instanceof Pos
  }

  copy() {
    return Pos.from(this.x, this.y)
  }

  inv() {
    return Pos.from(-this.x, -this.y)
  }

  add(s: Size) {
    return Pos.from(this.x + s.w, this.y + s.h)
  }

  sub(p: Pos): Size
  sub(s: Size): Pos
  sub(v: Pos | Size) {
    if (Pos.is(v)) {
      return Size.from(this.x - v.x, this.y - v.y)
    } else {
      return Pos.from(this.x - v.w, this.y - v.h)
    }
  }

  mul(d: number) {
    return Pos.from(this.x * d, this.y * d)
  }

  div(d: number) {
    return Pos.from(this.x / d, this.y / d)
  }

  min(p: Pos) {
    return Pos.from(Math.min(this.x, p.x), Math.min(this.y, p.y))
  }

  max(p: Pos) {
    return Pos.from(Math.max(this.x, p.x), Math.max(this.y, p.y))
  }

  floor() {
    return Pos.from(Math.floor(this.x), Math.floor(this.y))
  }

  ceil() {
    return Pos.from(Math.ceil(this.x), Math.ceil(this.y))
  }

  round() {
    return Pos.from(Math.round(this.x), Math.round(this.y))
  }

  dis(p: Pos) {
    return this.sub(p).len
  }

  flat(): [number, number] {
    return [this.x, this.y]
  }

  toString() {
    return `(${this.x}, ${this.y})`
  }
}

export class Size {
  w: number = 0
  h: number = 0

  set(w: number, h: number) {
    this.w = w
    this.h = h
    return this
  }

  static from(w: number, h: number) {
    return new Size().set(w, h)
  }

  static is(x: unknown): x is Size {
    return x instanceof Size
  }

  copy() {
    return Size.from(this.w, this.h)
  }

  inv() {
    return Size.from(-this.w, -this.h)
  }

  add(p: Pos): Pos
  add(s: Size): Size
  add(v: Pos | Size) {
    if (Pos.is(v)) {
      return Pos.from(v.x + this.w, v.y + this.h)
    } else {
      return Size.from(v.w + this.w, v.h + this.h)
    }
  }

  sub(s: Size) {
    return Size.from(this.w - s.w, this.h - s.h)
  }

  mul(d: number) {
    return Size.from(this.w * d, this.h * d)
  }

  div(d: number) {
    return Size.from(this.w / d, this.h / d)
  }

  min(s: Size) {
    return Size.from(Math.min(this.w, s.w), Math.min(this.h, s.h))
  }

  max(s: Size) {
    return Size.from(Math.max(this.w, s.w), Math.max(this.h, s.h))
  }

  floor() {
    return Size.from(Math.floor(this.w), Math.floor(this.h))
  }

  ceil() {
    return Size.from(Math.ceil(this.w), Math.ceil(this.h))
  }

  round() {
    return Pos.from(Math.round(this.w), Math.round(this.h))
  }

  get len() {
    return Math.sqrt(this.w * this.w + this.h * this.h)
  }

  flat(): [number, number] {
    return [this.w, this.h]
  }

  toString() {
    return `(${this.w}, ${this.h})`
  }
}

export class Box {
  origin: Pos = new Pos()
  size: Size = new Size()

  set(origin: Pos, size: Size) {
    this.origin = origin
    this.size = size
    return this
  }

  setOrigin(origin: Pos) {
    this.origin = origin
    return this
  }

  setSize(size: Size) {
    this.size = size
    return this
  }

  static from(lt: Pos, rb: Pos, preventNegative?: boolean): Box
  static from(origin: Pos, size: Size): Box
  static from(a: Pos, b: Pos | Size, f = false) {
    if (Pos.is(b)) {
      const s = b.sub(a)
      if (f) {
        if (s.w <= 0 || s.h <= 0) {
          s.set(0, 0)
        }
      }
      return new Box().set(a, s)
    } else {
      return new Box().set(a, b)
    }
  }

  static is(x: unknown): x is Box {
    return x instanceof Box
  }

  copy() {
    return Box.from(this.origin.copy(), this.size.copy())
  }

  normalize() {
    return Box.from(this.lt, this.rb)
  }

  ceil() {
    const lt = this.lt.floor()
    const rb = this.rb.ceil()
    this.origin = lt
    this.size = rb.sub(lt)
  }

  contains(p: Pos) {
    const lt = this.lt
    const rb = this.rb
    return lt.x <= p.x && p.x <= rb.x && lt.y <= p.y && p.y <= rb.y
  }

  intersect(b: Box) {
    return Box.from(this.lt.max(b.lt), this.rb.min(b.rb), true)
  }

  union(b: Box) {
    return Box.from(this.lt.min(b.lt), this.rb.max(b.rb))
  }

  get lt() {
    return this.origin.min(this.origin.add(this.size))
  }

  get lb() {
    return Pos.from(this.lt.x, this.rb.y)
  }

  get rt() {
    return Pos.from(this.rb.x, this.lt.y)
  }

  get rb() {
    return this.origin.max(this.origin.add(this.size))
  }

  get l() {
    return Math.min(this.origin.x, this.origin.x + this.size.w)
  }

  get t() {
    return Math.min(this.origin.y, this.origin.y + this.size.h)
  }

  get r() {
    return Math.max(this.origin.x, this.origin.x + this.size.w)
  }

  get b() {
    return Math.max(this.origin.y, this.origin.y + this.size.h)
  }

  flat(): [number, number, number, number] {
    return [...this.origin.flat(), ...this.size.flat()]
  }

  toString() {
    return `[${this.origin}, ${this.size}]`
  }
}

export class Viewport {
  // based on model
  origin: Pos = new Pos()
  // based on view
  offset: Pos = new Pos()
  // 1vpx = 1px * scale
  scale: number = 1

  toView(p: Pos): Pos
  toView(s: Size): Size
  toView(b: Box): Box
  toView(x: Pos | Size | Box) {
    if (Pos.is(x)) {
      return x.sub(this.origin).div(this.scale).add(this.offset)
    } else if (Size.is(x)) {
      return x.div(this.scale)
    } else {
      return Box.from(this.toView(x.origin), this.toView(x.size))
    }
  }

  fromView(p: Pos): Pos
  fromView(s: Size): Size
  fromView(b: Box): Box
  fromView(x: Pos | Size | Box) {
    if (Pos.is(x)) {
      return x.sub(this.offset).mul(this.scale).add(this.origin)
    } else if (Size.is(x)) {
      return x.mul(this.scale)
    } else {
      return Box.from(this.fromView(x.origin), this.fromView(x.size))
    }
  }

  reset() {
    this.offset = new Pos()
    this.scale = 1
  }

  zoom(direct: boolean, vp: Pos, ratio = 1.1) {
    const oldPos = this.fromView(vp)
    this.scale *= direct ? 1 / ratio : ratio
    const newFix = this.toView(oldPos)
    this.offset = this.offset.add(vp.sub(newFix))
  }

  toString() {
    return `origin: ${this.origin}
offset: ${this.offset}
scale: ${this.scale}`
  }
}

export class DragHandler {
  state: boolean = false
  start: Pos = new Pos()
  stop: Pos = new Pos()

  base: Pos = new Pos()

  down(p: Pos, b: Pos) {
    this.state = true
    this.start = this.stop = p
    this.base = b
  }

  move(p: Pos) {
    this.stop = p
  }

  up() {
    this.state = false
  }

  get box() {
    return Box.from(this.base, this.delta).normalize()
  }

  get delta() {
    return this.stop.sub(this.start)
  }

  get current() {
    return this.base.add(this.delta)
  }
}
