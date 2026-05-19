#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/stigpt}"
BACKEND_REPO="${BACKEND_REPO:-https://github.com/admin13786/StiGPT_backend.git}"
FRONTEND_REPO="${FRONTEND_REPO:-https://github.com/admin13786/StiGPT_Frontend.git}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -d backend/.git ]; then
  git clone "$BACKEND_REPO" backend
fi

if [ ! -d frontent/.git ]; then
  git clone "$FRONTEND_REPO" frontent
fi

if [ ! -f "$APP_DIR/frontent/.env" ]; then
  cp "$APP_DIR/frontent/.env.example" "$APP_DIR/frontent/.env"
  echo "Created $APP_DIR/frontent/.env. Fill production secrets before starting the stack."
  exit 1
fi

cd "$APP_DIR/frontent"
docker compose -p stigpt up -d --build
docker compose -p stigpt ps
