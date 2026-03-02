#!/bin/bash

ver=`cat scripts/.maaver`

for dir in extension maa-tools maa-server maa-server-proto maa-pipeline-manager types webview; do
  cd pkgs/$dir
  pnpm i -D @maaxyz/maa-node@$ver
  cd -
done
