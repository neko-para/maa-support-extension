export let fulfillImage: (url: string) => void = () => {}

export function setFulfillImage(fi: (url: string) => void) {
  fulfillImage = fi
}
