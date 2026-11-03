declare module 'node:process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        MAAFW_MODULE_PATH: string
        MAAFW_STDOUT_LEVEL?: string
        MAAFW_LOG_DIR: string
        MAAFW_RESOURCE_PATHS: string
        MAATOOLS_POOL_ID: string
        /** 已解析的 agent 列表（JSON），由 run.ts 传给 worker。 */
        MAATOOLS_AGENTS?: string
        /** 本次进程池待识别节点（JSON），用于判断哪些 Custom 识别必须由 agent 提供。 */
        MAATOOLS_NODES?: string
      }
    }
  }
}
