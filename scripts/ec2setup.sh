#!/bin/bash -ex


# no current parameters to the script

# run update
yum update

# enable epel
yum-config-manager --enable epel && yum clean all 

# install node
yum install nodejs npm


# adjust file limits etc
cat <<EOT >> /etc/security/limits.d/custom.conf
root soft nofile 1000000
root hard nofile 1000000
* soft nofile 1000000
* hard nofile 1000000
EOT

cat <<EOT >> /etc/sysctl.conf
fs.file-max = 1000000
fs.nr_open = 1000000       
net.ipv4.netfilter.ip_conntrack_max = 1048576
net.nf_conntrack_max = 1048576
EOT

sudo sh -c "ulimit -n 100000 && exec su $LOGNAME"


# install git
yum install git

# setup tester app
mkdir /usr/apps
cd /usr/apps
# lets clone full repo. might wanna fetch changes too
git clone https://github.com/kksharma1618/websocket-bench kkwebsocketbench
# link for command access
cd /usr/apps/kkwebsocketbench
npm link


