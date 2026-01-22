import { Node } from 'jsonc-parser'
import * as vscode from 'vscode'

import { AbsolutePath } from '@mse/pipeline-manager'

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

export async function autoConvertRange(location: Node, file: AbsolutePath) {
  const doc = await vscode.workspace.openTextDocument(file)
  return convertRange(doc, location)
}

export async function autoBuildRange(offset: number, length: number, file: AbsolutePath) {
  const doc = await vscode.workspace.openTextDocument(file)
  return new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
}

export async function autoConvertRangeLocation(dr: { file: AbsolutePath; location: Node }) {
  const doc = await vscode.workspace.openTextDocument(dr.file)
  return convertRangeLocation(doc, dr.location)
}
