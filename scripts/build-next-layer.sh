#!/bin/sh

set -e

LAMBDA_FOLDER=nodejs

mkdir -p dist

npm install \
    --arch=x64 \
    --platform=linux \
    --target=16.15 \
    --libc=glibc \
    --prefix=$LAMBDA_FOLDER \
    next

zip -q -r dist/next-layer.zip $LAMBDA_FOLDER

rm -rf $LAMBDA_FOLDER
