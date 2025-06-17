export const cspMeta = `<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; font-src %{cspSource}; style-src 'unsafe-inline' %{cspSource}; script-src %{cspSource}; img-src %{cspSource} data:; connect-src %{cspSource} data:;"
/>`
