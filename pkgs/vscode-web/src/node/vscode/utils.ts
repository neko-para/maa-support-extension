export const forwardIframe = (url: string) => {
  return `
<html>
  <head>
    <style>
      body {
        padding: 0;
      }
      iframe {
        position: fixed;
        width: 100%;
        height: 100%;
        border-width: 0;
      }
    </style>
  </head>
  <body>
    <iframe src="${url}"></iframe>
  </body>
</html>
`
}

export function withResolvers<T>(): [Promise<T>, (value: T) => void] {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return [promise, resolve]
}
