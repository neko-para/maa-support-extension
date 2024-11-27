#!/bin/bash

npm i -f @maaxyz/maa-node
for os in win32 linux darwin; do
  for arch in x64 arm64; do
    npm i -f @maaxyz/maa-node-${os}-${arch}
  done
done
