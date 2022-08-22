#!/bin/sh
set -e

# Current root for reference.
MY_ROOT=$(pwd)

# Folder where zip files will be outputed for CDK to pickup.
OUTPUT_PATH=next.out

# Name of folder where public files are located.
# Keep in mind that in order to be able to serve those files without references in next (so files)
# such as webmanifest, icons, etc. you need to nest them in public/assets folder as asset is key
# used to distinguist pages from public assets.
PUBLIC_FOLDER=public

HANDLER_PATH=$MY_ROOT/dist/server-handler.js
STANDALONE_PATH=$MY_ROOT/.next/standalone

# This is a folder prefix where layers are mounted in Lambda.
# Dependencies are mounted in /opt/nodejs and assets in /opt/assets.
LAMBDA_LAYER_FOLDER=opt

# This is a setup for parsing next server configuration from standalone server.js file.
# Webpack is used as a keywork for identifying correct line to pick.
NEXT_CONFIG=
GREP_BY=webpack

echo "My root is: $MY_ROOT"

echo "Cleaning possible left-overs."
rm -rf $MY_ROOT/$OUTPUT_PATH

echo "Creating output folder."
mkdir -p $MY_ROOT/$OUTPUT_PATH

#
# -------------------------- Create deps layer --------------------------
echo "Creating dependencies layer."
DEPS_FOLDER=$MY_ROOT/$OUTPUT_PATH/nodejs
NODE_FOLDER=$STANDALONE_PATH/node_modules

mkdir -p $DEPS_FOLDER

cp -r $NODE_FOLDER $DEPS_FOLDER

echo "Zipping dependencies."
cd $MY_ROOT/$OUTPUT_PATH

# Zip dependendencies, recursive & quite.
zip -r -q -m ./dependenciesLayer.zip ./nodejs

#
# -------------------------- Create assets layer --------------------------
echo "Creating assets layer."
ASSETS_FOLDER=$MY_ROOT/$OUTPUT_PATH/assets

mkdir -p $ASSETS_FOLDER
mkdir -p $ASSETS_FOLDER/_next/static
cp -r $MY_ROOT/.next/static/* $ASSETS_FOLDER/_next/static/
cp -r $MY_ROOT/$PUBLIC_FOLDER/* $ASSETS_FOLDER/

echo "Zipping assets."
cd $ASSETS_FOLDER

# Zip assets, recursive & quite.
zip -r -q -m $MY_ROOT/$OUTPUT_PATH/assetsLayer.zip ./

#
# -------------------------- Create code layer --------------------------

echo "Creating code layer."
CODE_FOLDER=$MY_ROOT/$OUTPUT_PATH/code

mkdir -p $CODE_FOLDER

# Copy code files and other helpers.
# Don't include * in the end of rsync path as it would omit .next folder.
rsync -a --exclude='node_modules' --exclude '*.zip' $STANDALONE_PATH/ $CODE_FOLDER
cp $HANDLER_PATH $CODE_FOLDER/handler.js

# Create layer symlink
ln -s /$LAMBDA_LAYER_FOLDER/nodejs/node_modules $CODE_FOLDER/node_modules
ln -s /$LAMBDA_LAYER_FOLDER/assets/public $CODE_FOLDER/public

#
# -------------------------- Extract nextjs config --------------------------
NEXT_SERVER_PATH=$STANDALONE_PATH/server.js
while read line; do
    if echo "$line" | grep -p -q $GREP_BY; then NEXT_CONFIG=$line; fi
done <$NEXT_SERVER_PATH

# Remove trailing "," and beginning of line "conf:"
echo $NEXT_CONFIG | sed 's/.$//' | sed 's/conf:/ /g' >$CODE_FOLDER/config.json

echo "Zipping code."
cd $CODE_FOLDER

# Zip code, recursive, don't resolve symlinks.
zip -r -q -m --symlinks $MY_ROOT/$OUTPUT_PATH/code.zip ./
