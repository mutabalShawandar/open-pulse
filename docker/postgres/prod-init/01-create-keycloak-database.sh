#!/bin/sh
set -eu

# This is evaluated only when the named Postgres volume is first created.
# psql variable quoting keeps identifiers and passwords out of shell-expanded SQL.
psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=keycloak_database="$KEYCLOAK_POSTGRES_DB" \
  --set=keycloak_user="$KEYCLOAK_POSTGRES_USER" \
  --set=keycloak_password="$KEYCLOAK_POSTGRES_PASSWORD" <<'SQL'
CREATE ROLE :"keycloak_user" LOGIN PASSWORD :'keycloak_password';
CREATE DATABASE :"keycloak_database" OWNER :"keycloak_user";
SQL
