#!/usr/bin/env bash
set -euo pipefail

# One-shot deployment script for GCP VM
# Usage:
#   sudo DOMAIN=learnnovice.com REPO_URL=https://github.com/Novice130/word-to-presentation.git ./deploy/deploy_vm.sh
# If you want the app mounted at /citcd (recommended), this will configure Nginx accordingly.

DOMAIN=${DOMAIN:-}
REPO_URL=${REPO_URL:-https://github.com/Novice130/word-to-presentation.git}
APP_DIR=${APP_DIR:-/var/www/citcd}
APP_USER=${APP_USER:-www-data}
BRANCH=${BRANCH:-master}

if [ -z "$DOMAIN" ]; then
  echo "ERROR: DOMAIN environment variable is required. Example: DOMAIN=citcd.learnnovice.com"
  exit 1
fi

echo "Deploying app to $APP_DIR for domain $DOMAIN"

echo "1) Update and install system packages"
apt update
apt install -y python3-venv python3-pip nginx git libreoffice certbot python3-certbot-nginx ufw

echo "2) Create app directory and clone repo"
mkdir -p $(dirname "$APP_DIR")
if [ ! -d "$APP_DIR" ]; then
  git clone --depth=1 -b "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi
chown -R $SUDO_USER:$SUDO_USER "$APP_DIR" || true

echo "3) Create Python virtualenv and install requirements"
cd "$APP_DIR"
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
if [ -f requirements.txt ]; then
  pip install -r requirements.txt
else
  pip install flask python-docx python-pptx PyPDF2 pillow gunicorn lxml requests
  pip freeze > requirements.txt
fi

echo "4) Create uploads directory and set permissions"
mkdir -p "$APP_DIR/uploads"
chown -R $APP_USER:$APP_USER "$APP_DIR/uploads" || chown -R $SUDO_USER:$SUDO_USER "$APP_DIR/uploads"

echo "5) Install and enable Gunicorn systemd service"
SERVICE_FILE=/etc/systemd/system/citcd.service
cat > /tmp/citcd.service <<EOF
[Unit]
Description=Gunicorn instance to serve citcd Flask app
After=network.target

[Service]
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${APP_DIR}/.venv/bin"
ExecStart=${APP_DIR}/.venv/bin/gunicorn --workers 3 --bind unix:/run/citcd.sock app:app

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/citcd.service $SERVICE_FILE
sudo systemctl daemon-reload
sudo systemctl enable --now citcd
sudo journalctl -u citcd --no-pager -n 30 || true

echo "6) Configure Nginx to serve under /citcd path and static files"
NGINX_FILE=/etc/nginx/sites-available/citcd
sudo cp "$APP_DIR/deploy/nginx_citcd_path" /tmp/nginx_citcd_path
sudo sed -i "s/server_name learnnovice.com;/server_name ${DOMAIN};/g" /tmp/nginx_citcd_path || true
sudo mv /tmp/nginx_citcd_path $NGINX_FILE
sudo ln -sf $NGINX_FILE /etc/nginx/sites-enabled/citcd
sudo nginx -t
sudo systemctl reload nginx

echo "7) Open firewall ports (optional)"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
if ufw status | grep -q inactive; then
  echo "UFW inactive — enabling"
  ufw --force enable || true
fi

echo "8) Obtain TLS certificate with Certbot (ensure Cloudflare DNS points to this VM and is DNS-only during issuance)"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@${DOMAIN} || echo "Certbot may have failed — run interactively: sudo certbot --nginx -d ${DOMAIN}"

echo "9) Final permissions and restart services"
chown -R ${APP_USER}:${APP_USER} "$APP_DIR"
systemctl restart citcd || true
systemctl restart nginx || true

echo "Deployment complete. Visit: https://${DOMAIN}/citcd/"
echo "If your site is the main site and you want /citcd path on learnnovice.com, ensure your main site Nginx server block includes this citcd config or that this server_name matches your site server block."

exit 0
