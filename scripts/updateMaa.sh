#!/bin/bash

ver=`cat scripts/.maaver`

for dir in webview extension types maa-support maa-support-types maa-support-webview; do
  cd pkgs/$dir
  pnpm i -D @maaxyz/maa-node@$ver
  cd -
done
