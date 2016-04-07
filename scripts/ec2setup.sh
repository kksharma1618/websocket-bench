#!/bin/bash -ex


# no current parameters to the script

# run update
sudo yum update -y

# enable epel
sudo yum-config-manager --enable epel

# install node
sudo yum install -y nodejs npm


# adjust file limits etc
sudo tee -a /etc/security/limits.d/custom.conf >/dev/null <<EOT
root soft nofile 1000000
root hard nofile 1000000
* soft nofile 1000000
* hard nofile 1000000

EOT


sudo tee -a /etc/sysctl.conf >/dev/null <<EOT
fs.file-max = 1000000
fs.nr_open = 1000000       
net.ipv4.netfilter.ip_conntrack_max = 1048576
net.nf_conntrack_max = 1048576

EOT

sudo sh -c "ulimit -n 100000 && exec su $LOGNAME"


# install git
sudo yum install -y git

# setup tester app
sudo mkdir /usr/apps
sudo chown -R ec2-user:ec2-user /usr/apps
cd /usr/apps
# lets clone full repo. might wanna fetch changes too
git clone https://github.com/kksharma1618/websocket-bench kkwebsocketbench
# link for command access
cd /usr/apps/kkwebsocketbench
sudo npm link


