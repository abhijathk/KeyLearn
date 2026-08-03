#!/usr/bin/env bash

if [[ "$(id -u)" != "0" ]]; then
    echo "This script must be run as root." 1>&2
    exit 1
fi

function install_service() {
    cp /opt/keylearn/etc/$1 /etc/systemd/system/$1
    systemctl enable $1
}

function report_service() {
    echo $1 $(systemctl is-active $1)
}

function configure_nginx() {
    rm -fr /etc/nginx/*
    mkdir -p /etc/nginx/{conf.d,modules-{available,enabled},sites-{available,enabled}}
    cp -r /opt/keylearn/etc/nginx/* /etc/nginx/
}

function install_binary() {
    ln -s -f /opt/keylearn/keylearn.js /usr/bin/keylearn
}

install_binary

install_service keylearn.service
install_service keylearn-backup-database.service
install_service keylearn-backup-database.timer
install_service keylearn-remove-sessions.service
install_service keylearn-remove-sessions.timer

configure_nginx

systemctl restart mysql.service
systemctl restart nginx.service
systemctl restart keylearn.service

report_service mysql.service
report_service nginx.service
report_service keylearn.service
report_service keylearn-backup-database.service
report_service keylearn-backup-database.timer
report_service keylearn-remove-sessions.service
report_service keylearn-remove-sessions.timer
