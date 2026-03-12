#!/bin/bash
set -e

echo "Installing dependencies..."
pip install -r requirements.txt --quiet

echo "Building application..."
pyinstaller baseballlog.spec --noconfirm

echo "Copying to Desktop..."
rm -rf ~/Desktop/BaseballLog.app
cp -r dist/BaseballLog.app ~/Desktop/

echo "Done! BaseballLog.app updated on Desktop."
