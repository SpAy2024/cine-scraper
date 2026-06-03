FROM php:8.2-apache

RUN docker-php-ext-install mysqli pdo pdo_mysql
RUN a2enmod rewrite

# Instalar curl
RUN apt-get update && apt-get install -y libcurl4-openssl-dev && docker-php-ext-install curl

COPY . /var/www/html/

RUN chmod -R 755 /var/www/html
RUN mkdir -p /var/www/html/logs && chmod 777 /var/www/html/logs

EXPOSE 80