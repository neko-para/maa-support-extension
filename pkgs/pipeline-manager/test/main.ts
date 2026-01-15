import { Bundle, FsContentLoader, FsContentWatcher, Interface, parseInterface, parseTask } from '..'

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

  const int = new Interface(
    new FsContentLoader(),
    new FsContentWatcher(),
    '/Users/nekosu/Documents/Projects/MAA/M9A/assets'
  )

  await int.load()

  console.log(parseInterface(int.content.node!))
}

main()
