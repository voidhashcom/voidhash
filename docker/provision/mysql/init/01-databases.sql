-- create databases
CREATE DATABASE IF NOT EXISTS `voidhash`;
CREATE DATABASE IF NOT EXISTS `voidhash_test`;

-- create root user and grant rights
-- CREATE USER 'root'@'%' IDENTIFIED BY 'password';
-- GRANT ALL ON *.* TO 'root'@'%';

-- create voidhash user and grant rights
CREATE USER 'voidhash'@'%' IDENTIFIED BY 'password';
GRANT ALL ON `voidhash`.* TO 'voidhash'@'%';

-- create voidhash_test user and grant rights
CREATE USER 'voidhash_test'@'%' IDENTIFIED BY 'password';
GRANT ALL ON `voidhash_test`.* TO 'voidhash_test'@'%';
