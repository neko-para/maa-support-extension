import type { LayerInfo } from '../../layer/layer'
import type { InterfaceDeclInfo, InterfaceRefInfo } from '../../parser/interface/interface'

export class ProjectState {
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
  layer: LayerInfo
  bundles: LayerInfo[]

  constructor(
    decls: InterfaceDeclInfo[],
    refs: InterfaceRefInfo[],
    layer: LayerInfo,
    bundles: LayerInfo[]
  ) {
    this.decls = decls
    this.refs = refs
    this.layer = layer
    this.bundles = bundles
  }

  allControllerNames(onlyWithAttaches = false) {
    return this.decls
      .filter(decl => decl.type === 'interface.controller')
      .filter(onlyWithAttaches ? decl => decl.attachs.length > 0 : () => true)
      .map(info => info.name)
  }

  allResourceNames(checkController = '') {
    return this.decls
      .filter(decl => decl.type === 'interface.resource')
      .filter(
        checkController
          ? decl => !decl.controller || decl.controller.includes(checkController)
          : () => true
      )
      .map(info => info.name)
  }
}
