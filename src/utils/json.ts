import { type JSONPath, visit } from 'jsonc-parser'
import * as vscode from 'vscode'

export function visitJsonDocument(
  doc: vscode.TextDocument,
  visitor: {
    onObjectProp?: (prop: string, range: vscode.Range, path: JSONPath) => void
    onObjectBegin?: (start: vscode.Position, path: JSONPath) => void
    onObjectEnd?: (range: vscode.Range, path: JSONPath) => void
    onArrayBegin?: (start: vscode.Position, path: JSONPath) => void
    onArrayEnd?: (range: vscode.Range, path: JSONPath) => void
    onLiteral?: (
      value: string | number | boolean | null,
      range: vscode.Range,
      path: JSONPath
    ) => void
  }
) {
  const path: JSONPath = []
  const positionStack: vscode.Position[] = []

  visit(doc.getText(), {
    onObjectProperty: (property, offset, length, startLine, startCharacter, pathSupplier) => {
      path[path.length - 1] = property
      //
      visitor.onObjectProp?.(
        property,
        new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length)),
        path
      )
    },
    onObjectBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
      const pos = doc.positionAt(offset)
      positionStack.push(pos)
      visitor.onObjectBegin?.(pos, path)
      //
      path.push('')
    },
    onObjectEnd: (offset, length, startLine, startCharacter) => {
      path.pop()
      //
      const pos = positionStack.pop()
      if (pos) {
        visitor.onObjectEnd?.(new vscode.Range(pos, doc.positionAt(offset + length)), path)
      }
    },
    onSeparator: (character, offset, length, startLine, startCharacter) => {
      if (character === ',') {
        if (typeof path[path.length - 1] === 'number') {
          ;(path[path.length - 1] as number)++
        }
      } else if (character === ':') {
      }
    },
    onArrayBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
      const pos = doc.positionAt(offset)
      positionStack.push(pos)
      visitor.onArrayBegin?.(pos, path)
      //
      path.push(0)
    },
    onArrayEnd: (offset, length, startLine, startCharacter) => {
      path.pop()
      //
      const pos = positionStack.pop()
      if (pos) {
        visitor.onArrayEnd?.(new vscode.Range(pos, doc.positionAt(offset + length)), path)
      }
    },
    onLiteralValue: (value, offset, length, startLine, startCharacter, pathSupplier) => {
      visitor.onLiteral?.(
        value,
        new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length)),
        path
      )
    },
    onError: (error, offset, length, startLine, startCharacter) => {}
  })
}
