#!/bin/bash
cd backend
go build -o server ./cmd/server/main.go
echo "GO Backend Build Completed"
