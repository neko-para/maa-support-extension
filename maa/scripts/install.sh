#!/bin/bash

ver=`cat .maaver`
pkgver=`cat .maapkgver`
echo "MaaNode version $ver as $pkgver"

for os in win32 linux darwin; do
  for arch in x64 arm64; do
    if [[ "$os" == "win32" ]] && [[ "$arch" == "arm64" ]]; then
      continue
    fi

    echo "Packaging ${os}-${arch}"

    rm -rf node_modules
    rm -f package-lock.json
    git checkout package.json
    git checkout README.md

    npm pkg set version=${pkgver}
    sed -i "s/%VERSION%/${ver}/g" README.md
    sed -i "s/%TRIPLET%/${os}-${arch}/g" README.md

    npm i -f @maaxyz/maa-node@${ver}
    npm i -f @maaxyz/maa-node-${os}-${arch}@${ver}

    vsce package --target "${os}-${arch}"
  done
done
