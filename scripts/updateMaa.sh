#!/bin/bash

ver=`cat maa/.maaver`

for dir in controlPanel extension types; do
  cd pkgs/$dir
  pnpm i -D @maaxyz/maa-node@$ver
  cd -
done
