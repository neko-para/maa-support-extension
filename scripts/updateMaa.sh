#!/bin/bash

ver=`cat scripts/.maaver`

for dir in webview extension types; do
  cd pkgs/$dir
  pnpm i -D @maaxyz/maa-node@$ver
  cd -
done
