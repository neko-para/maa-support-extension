/**
 *
 * @param {import("@maaxyz/maa-node").ControllerBase} controller
 * @param {import("@maaxyz/maa-node").ResourceBase} resource
 * @param {import("@maaxyz/maa-node").TaskerBase} tasker
 * @param {Record<'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly', (msg: string) => void>} logger
 */
module.exports = function (controller, resource, tasker, logger) {
  logger.info('mse setup!')
  resource.register_custom_recognizer('mse', self => {
    logger.info(`Hello world from custom reco mse, self ${JSON.stringify(self)}`)
    return null
  })
  resource.register_custom_action('mse', self => {
    logger.info(`Hello world from custom action mse, self ${JSON.stringify(self)}`)
    return true
  })
}
