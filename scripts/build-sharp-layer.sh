#!/bin/sh

set -e

LAMBDA_FOLDER=nodejs
SHARP_IGNORE_GLOBAL_LIBVIPS=1

mkdir -p dist

npm install \
    --arch=x64 \
    --platform=linux \
    --target=16.15 \
    --libc=glibc \
    --prefix=$LAMBDA_FOLDER \
    --ignore-scripts=false \
    --verbose \
    sharp

zip -q -r dist/sharp-layer.zip $LAMBDA_FOLDER

rm -rf $LAMBDA_FOLDER
