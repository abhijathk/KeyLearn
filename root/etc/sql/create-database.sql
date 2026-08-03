create database if not exists `keylearn`
  default charset `utf8`
  default collate `utf8_general_ci`;

create user if not exists 'keylearn'@'localhost';

alter user 'keylearn'@'localhost' identified with mysql_native_password by '';

grant all privileges on `keylearn`.* to 'keylearn'@'localhost';

flush privileges;
