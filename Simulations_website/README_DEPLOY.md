# Deployment guide for citcd (learnnovice.com/citcd)

This file contains example commands and configuration snippets to deploy the Flask app using Gunicorn + systemd and Nginx on an Ubuntu/Debian server. It assumes you will use a subdomain `citcd.learnnovice.com` (recommended). If you must use the path `/citcd` instead, see the note below.

1. Server setup (Ubuntu example)

```bash
ssh user@your-server
sudo apt update
sudo apt install -y python3-venv python3-pip nginx git libreoffice
```

2. Clone repo and create venv

```bash
cd /var/www
sudo git clone <your-repo-url> citcd
sudo chown -R $USER:$USER citcd
cd citcd
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

3. Test app

```bash
. .venv/bin/activate
python app.py   # ensure it runs on localhost:5000
```

4. Install Gunicorn and configure systemd

# Copy `deploy/citcd.service` to `/etc/systemd/system/citcd.service`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl start citcd
sudo systemctl enable citcd
sudo journalctl -u citcd -f
```

5. Configure Nginx

# Copy `deploy/nginx_citcd` to `/etc/nginx/sites-available/citcd`

```bash
sudo ln -s /etc/nginx/sites-available/citcd /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

6. Obtain SSL (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d citcd.learnnovice.com
```

7. Permissions & LibreOffice

- Ensure `/var/www/citcd/uploads` exists and is writable by the service user (e.g., `www-data`).
- `libreoffice` (soffice) must be installed and in PATH for `.doc` → `.docx` conversion.

Notes about serving under a path `/citcd` instead of a subdomain:

- Serving under a path is more complex. You must ensure the WSGI app is aware of `SCRIPT_NAME` or set Flask `APPLICATION_ROOT` and adjust the Nginx `proxy_set_header` for `SCRIPT_NAME` and `X-Script-Name` as needed. Using a subdomain avoids these extra steps.

Testing after deployment:

- Upload a representative document (especially your problematic Section B) and confirm the returned PPTX respects the chosen font and line spacing.

If you want, I can generate the exact `/etc/nginx/sites-available/citcd` and the exact `/etc/systemd/system/citcd.service` (already included in `deploy/`) with adjusted paths for your server user — tell me the remote server paths and the system user to use.
