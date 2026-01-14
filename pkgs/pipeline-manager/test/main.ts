import { Bundle, FsContentLoader, FsContentWatcher } from '..'

async function main() {
  const bundle = new Bundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    '/Users/nekosu/Documents/Projects/MAA/M9A/assets/resource/base'
  )
  await bundle.content.load()

  console.log(Object.keys(bundle.tasks).length)
  bundle.on('taskChanged', changed => {
    console.log(changed)
  })
  bundle.on('imageChanged', () => {
    console.log('image changed')
  })
}

main()
