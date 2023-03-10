#!/bin/sh

CUR=$(pwd)

CURRENT=$(cd $(dirname $0);pwd)
echo "${CURRENT}"

cd "${CURRENT}"
git pull --prune
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi
pwd
yarn install && yarn upgrade
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi


cd "${CURRENT}/front"
git pull --prune
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi
pwd
yarn install && yarn upgrade && yarn lint && yarn build && yarn export
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi

cd "${CURRENT}/cdk"
git pull --prune
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi
pwd
yarn install && yarn upgrade && yarn lint && yarn build
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi

git commit -am "Bumps node modules" && git push
result=$?
if [ $result -ne 0 ]; then
  cd "${CUR}"
  exit $result
fi

cd "${CUR}"
