#!/bin/sh
set -eu

policy_file=/opt/aegis/content-security-policy.txt
if [ ! -s "$policy_file" ]; then
  echo "Production frontend image is missing content-security-policy.txt" >&2
  exit 1
fi

policy=$(tr -d '\r\n' < "$policy_file")
case "$policy" in
  *\"*)
    echo "Content Security Policy contains a double quote and cannot be written safely." >&2
    exit 1
    ;;
esac

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    include /etc/nginx/aegis-security-headers.conf;

    location /assets/ {
        include /etc/nginx/aegis-security-headers.conf;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files \$uri =404;
    }

    location = /index.html {
        include /etc/nginx/aegis-security-headers.conf;
        add_header Cache-Control "no-cache" always;
    }

    location / {
        include /etc/nginx/aegis-security-headers.conf;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

cat > /etc/nginx/aegis-security-headers.conf <<EOF
add_header Content-Security-Policy "${policy}" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Frame-Options "DENY" always;
add_header Strict-Transport-Security "max-age=15552000" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
EOF
