declare module 'node:process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        MAAFW_MODULE_PATH: string
        MAAFW_STDOUT_LEVEL?: string
        MAAFW_LOG_DIR: string
        MAAFW_RESOURCE_PATHS: string
        MAATOOLS_POOL_ID: string
      }
    }
  }
}
