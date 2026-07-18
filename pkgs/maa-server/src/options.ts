export let option: {
  id: string
  port: number
  module: string
  workDir: string
  debugMode: boolean
}

export function initOptions() {
  option = JSON.parse(Buffer.from(process.argv[2], 'base64').toString())
  console.log(option)
}
