import { type JSONPath, visit } from 'jsonc-parser'
import * as vscode from 'vscode'

export { type JSONPath } from 'jsonc-parser'

export function visitJsonDocument<State = unknown>(
  doc: vscode.TextDocument,
  visitor: {
    onObjectProp?: (prop: string, range: vscode.Range, path: JSONPath) => State | undefined
    onObjectBegin?: (start: vscode.Position, path: JSONPath, state?: State) => void
    onObjectEnd?: (range: vscode.Range, path: JSONPath, state?: State) => void
    onArrayBegin?: (start: vscode.Position, path: JSONPath) => void
    onArrayEnd?: (range: vscode.Range, path: JSONPath) => void
    onLiteral?: (
      value: string | number | boolean | null,
      range: vscode.Range,
      path: JSONPath,
      state?: State
    ) => void
  }
) {
  const path: JSONPath = []
  const positionStack: vscode.Position[] = []

  const states: (State | undefined)[] = [undefined]
  let afterProp = false

  visit(doc.getText(), {
    onObjectProperty: (property, offset, length, _startLine, _startCharacter, _pathSupplier) => {
      path[path.length - 1] = property
      //
      const state = visitor.onObjectProp?.(
        property,
        new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length)),
        path
      )
      states.unshift(state)
      afterProp = true
    },
    onObjectBegin: (offset, _length, _startLine, _startCharacter, _pathSupplier) => {
      if (!afterProp) {
        // 数组中的对象
        states.unshift(undefined)
      }
      afterProp = false

      const pos = doc.positionAt(offset)
      positionStack.push(pos)
      visitor.onObjectBegin?.(pos, path, states[0])
      //
      path.push('')
    },
    onObjectEnd: (offset, length, _startLine, _startCharacter) => {
      path.pop()
      //
      const pos = positionStack.pop()
      if (pos) {
        visitor.onObjectEnd?.(
          new vscode.Range(pos, doc.positionAt(offset + length)),
          path,
          states[0]
        )
        states.shift()
      }
    },
    onSeparator: (character, _offset, _length, _startLine, _startCharacter) => {
      if (character === ',') {
        if (typeof path[path.length - 1] === 'number') {
          ;(path[path.length - 1] as number)++
        }
      } else if (character === ':') {
        //
      }
    },
    onArrayBegin: (offset, _length, _startLine, _startCharacter, _pathSupplier) => {
      if (afterProp) {
        states.shift()
        afterProp = false
      }

      const pos = doc.positionAt(offset)
      positionStack.push(pos)
      visitor.onArrayBegin?.(pos, path)
      //
      path.push(0)
    },
    onArrayEnd: (offset, length, _startLine, _startCharacter) => {
      path.pop()
      //
      const pos = positionStack.pop()
      if (pos) {
        visitor.onArrayEnd?.(new vscode.Range(pos, doc.positionAt(offset + length)), path)
      }
    },
    onLiteralValue: (value, offset, length, _startLine, _startCharacter, _pathSupplier) => {
      if (afterProp) {
        afterProp = false
        states.shift()
      }

      visitor.onLiteral?.(
        value,
        new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length)),
        path,
        states.find(x => x !== undefined)
      )
    },
    onError: (_error, _offset, _length, _startLine, _startCharacter) => {}
  })
}
