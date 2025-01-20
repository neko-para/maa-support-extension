export function withResolvers<T = void>(): [Promise<T>, (value: T) => void] {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return [promise, resolve]
}
