# Deploy MCP Server ke VPS Ubuntu

Berikut langkah dasar untuk menjalankan server MCP di VPS berbasis Ubuntu.

## 1. Install Docker dan docker-compose
```bash
sudo apt update
sudo apt install docker.io docker-compose -y
```

## 2. Clone repository
```bash
git clone <url-repo>
cd mcp
```

## 3. Jalankan setup
```bash
bash setup.sh
```

## 4. Buka port firewall
Pastikan port **3000** untuk aplikasi dan **7700** untuk Meilisearch diizinkan.
Contoh menggunakan UFW:
```bash
sudo ufw allow 3000,7700/tcp
```

## 5. Cek status server
Akses `http://<ip-vps>:3000/status` untuk memastikan aplikasi berjalan.

## Reverse Proxy dengan Nginx
1. Install Nginx: `sudo apt install nginx -y`.
2. Buat konfigurasi server block yang meneruskan `example.com` ke `http://localhost:3000`.
3. Aktifkan situs dan reload Nginx.

Contoh snippet:
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## SSL dengan Let's Encrypt
Jika menggunakan Nginx, sertifikat gratis dapat diperoleh melalui Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d example.com
```
Sertifikat otomatis diperbarui oleh certbot.

## Menjalankan tanpa Docker menggunakan systemd
Bila tidak memakai Docker, jalankan server Node.js langsung dan buat unit systemd:

```ini
[Unit]
Description=MCP Server
After=network.target

[Service]
WorkingDirectory=/path/to/mcp
ExecStart=/usr/bin/node /path/to/mcp/server.js
Restart=always
Environment=PORT=3000
EnvironmentFile=/path/to/mcp/.env

[Install]
WantedBy=multi-user.target
```
Aktifkan dengan:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mcp
sudo systemctl start mcp
```
