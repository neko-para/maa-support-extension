import { Node } from 'jsonc-parser'
import * as vscode from 'vscode'

export function convertRange(document: vscode.TextDocument, location: Node) {
  return new vscode.Range(
    document.positionAt(location.offset),
    document.positionAt(location.offset + location.length)
  )
}

export function convertRangeWithDelta(
  document: vscode.TextDocument,
  location: Node,
  deltaRight = 0,
  deltaLeft = 0
) {
  return new vscode.Range(
    document.positionAt(location.offset + deltaLeft),
    document.positionAt(location.offset + location.length + deltaRight)
  )
}

export function convertRangeLocation(document: vscode.TextDocument, location: Node) {
  return new vscode.Location(document.uri, convertRange(document, location))
}
