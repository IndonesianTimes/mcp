#!/bin/bash

# Update paket
sudo apt update && sudo apt upgrade -y

# Install Node.js (versi LTS terbaru)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Cek versi Node.js & npm
node -v
npm -v

# Install Docker (CE)
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Tambah repository Docker
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update

# Install docker engine dan docker-compose-plugin
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Aktifkan docker service dan jalankan otomatis saat boot
sudo systemctl enable docker
sudo systemctl start docker

# Tambahkan user kamu ke grup docker (agar bisa jalankan docker tanpa sudo)
sudo usermod -aG docker $USER

# Install git (kalau belum ada)
sudo apt install -y git

# Install pm2 untuk manage node process (opsional tapi direkomendasikan)
sudo npm install -g pm2

# Bersihkan cache
sudo apt autoremove -y
sudo apt clean

echo "=== Instalasi selesai ==="
echo "Restart terminal / logout-login agar docker bisa dijalankan tanpa sudo."
