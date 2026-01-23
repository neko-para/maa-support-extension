import {
  Bundle,
  FsContentLoader,
  FsContentWatcher,
  InterfaceBundle,
  parseInterface,
  parseTask
} from '..'

async function main() {
  // const bundle = new Bundle(
  //   new FsContentLoader(),
  //   new FsContentWatcher(),
  //   '/Users/nekosu/Documents/Projects/MAA/M9A/assets/resource/base'
  // )
  // await bundle.load()

  // console.log(parseTask(bundle.tasks['EatMiniCandyMax'][0].node.children![1]))
  // // console.log(Object.keys(bundle.tasks).length)
  // bundle.on('taskChanged', changed => {
  //   // console.log(changed)
  // })
  // bundle.on('imageChanged', () => {
  //   // console.log('image changed')
  // })

  const int = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    '/Users/nekosu/Documents/Projects/MAA/M9A/assets'
  )

  await int.load()
  console.log(int.content.object)

  int.switchActive('B 服')

  int.on('bundleReloaded', () => {
    // console.log(int.info)
    console.log(int.paths)
  })
}

main()
