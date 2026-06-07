import type {
  InterfaceDeclInfo,
  InterfaceInfo,
  InterfaceRefInfo
} from '../../parser/interface/interface'

const NAME_ONLY_TYPES = [
  'interface.controller',
  'interface.resource',
  'interface.group',
  'interface.task',
  'interface.option'
] as const

const NAME_OPTION_TYPES = ['interface.case', 'interface.input'] as const

type NameOnlyType = (typeof NAME_ONLY_TYPES)[number]
type NameOptionType = (typeof NAME_OPTION_TYPES)[number]

function isNameOnlyType(type: string): type is NameOnlyType {
  return (NAME_ONLY_TYPES as readonly string[]).includes(type)
}

function isNameOptionType(type: string): type is NameOptionType {
  return (NAME_OPTION_TYPES as readonly string[]).includes(type)
}

export function findInterfaceMatchingDecls(
  index: InterfaceInfo,
  decl: InterfaceDeclInfo | null,
  ref: InterfaceRefInfo | null
): InterfaceDeclInfo[] | null {
  if (decl) {
    if (isNameOnlyType(decl.type)) {
      return index.decls.filter(d => d.type === decl.type && d.name === decl.name)
    }
    if (isNameOptionType(decl.type)) {
      return index.decls.filter(
        d =>
          d.type === decl.type &&
          d.name === decl.name &&
          (d as { option: string }).option === (decl as { option: string }).option
      )
    }
  } else if (ref) {
    if (isNameOnlyType(ref.type)) {
      return index.decls.filter(d => d.type === ref.type && d.name === ref.target)
    }
    if (isNameOptionType(ref.type)) {
      return index.decls.filter(
        d =>
          d.type === ref.type &&
          d.name === ref.target &&
          (d as { option: string }).option === (ref as { option: string }).option
      )
    }
  }
  return null
}

export function findInterfaceMatchingRefs(
  index: InterfaceInfo,
  decl: InterfaceDeclInfo | null,
  ref: InterfaceRefInfo | null
): InterfaceRefInfo[] | null {
  if (decl) {
    if (isNameOnlyType(decl.type)) {
      return index.refs.filter(r => r.type === decl.type && r.target === decl.name)
    }
    if (isNameOptionType(decl.type)) {
      return index.refs.filter(
        r =>
          r.type === decl.type &&
          r.target === decl.name &&
          (r as { option: string }).option === (decl as { option: string }).option
      )
    }
  } else if (ref) {
    if (isNameOnlyType(ref.type)) {
      return index.refs.filter(r => r.type === ref.type && r.target === ref.target)
    }
    if (isNameOptionType(ref.type)) {
      return index.refs.filter(
        r =>
          r.type === ref.type &&
          r.target === ref.target &&
          (r as { option: string }).option === (ref as { option: string }).option
      )
    }
  }
  return null
}
