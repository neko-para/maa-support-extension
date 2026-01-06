export async function setupFixedController(image: ArrayBuffer) {
  const ctrl = new maa.CustomController({
    connect() {
      return true
    },
    request_uuid() {
      return '0'
    },
    screencap() {
      return image
    }
  })
  ctrl.screenshot_use_raw_size = true
  await ctrl.post_connection().wait()
  if (!ctrl.connected) {
    ctrl.destroy()
    return null
  }

  return ctrl
}
