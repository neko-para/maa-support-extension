#!/bin/bash

ver=`cat scripts/.maaver`

for dir in extension maa-checker maa-server maa-server-proto pipeline-manager types webview; do
  cd pkgs/$dir
  pnpm i -D @maaxyz/maa-node@$ver
  cd -
done
