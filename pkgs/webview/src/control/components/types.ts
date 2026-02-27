export type OptionIntro = {
  type: 'global_option' | 'controller' | 'resource' | 'task' | 'option'
  name?: string
}

export type OptionInfo = {
  option: string
  intro: OptionIntro
}
