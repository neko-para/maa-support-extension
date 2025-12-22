import { ipc } from '../ipc'

export function revealOption(option: string) {
  ipc.send({
    command: 'revealInterface',
    dest: {
      type: 'option',
      option: option
    }
  })
}
