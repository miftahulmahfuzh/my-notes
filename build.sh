#!/bin/bash
cd backend
go build -o bin/silence-notes-server ./cmd/server/main.go
echo "Build completed"