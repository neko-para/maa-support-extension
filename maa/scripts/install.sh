#!/bin/bash

ver=`cat .maaver`
pkgver=`cat .maapkgver`
echo "MaaNode version $ver as $pkgver"

npm i -f @maaxyz/maa-node@${ver}

for os in win32 linux darwin; do
  for arch in x64 arm64; do
    npm i -f @maaxyz/maa-node-${os}-${arch}@${ver}
  done
done

npm pkg set version=${pkgver}
