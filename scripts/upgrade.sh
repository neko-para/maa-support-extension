#!/bin/bash

for dir in `ls pkgs`; do
  cd pkgs/$dir
  npx npm-check-updates -u
  cd -
done
