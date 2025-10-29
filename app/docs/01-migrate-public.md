# Steps to migrate prod database to public facing

1. Dump local database to a file
2. Host local file via copyparty + cloudflared tunnel
3. Download file on remote host
4. Copy file into docker container
5. Run restore process with the file inside the docker container

Note: this process works because I already started my Docker compose setup with the database running. This ran Prisma migrations so that the database is ready to go and schemas match exactly.

## Step 1 - Dump local database to a file

```bash
docker exec -e PGPASSWORD=postgres b60c4ce0fdc3 \
  pg_dump \
    -h 127.0.0.1 \
    -p 5432 \
    -U postgres \
    -d visual_notes \
    -F c \
    -f visual-notes.dump
```

## Step 2 - Host local file via copyparty + cloudflared tunnel

```bash
uv run tool copyparty
```

```
cloudflared tunnel --url http://192.168.1.125:3923
```

That step gives a random domain to test with: `https://miss-spanking-adventures-latino.trycloudflare.com/visual-notes.dump`

## Step 3 - Download file on remote host

```bash
curl -o visual-notes.dump https://miss-spanking-adventures-latino.trycloudflare.com/visual-notes.dump
```

## Step 4 - Copy file into docker container

Determine the container name: `docker ps` then search for it in the logs

```bash
docker cp visual-notes.dump b60c4ce0fdc3:/tmp/visual-notes.dump
```

Run command to restore the database.

```bash
docker exec -e PGPASSWORD=postgres b60c4ce0fdc3 \
  pg_restore \
    -h 127.0.0.1 \
    -p 5432 \
    -U postgres \
    -d visual_notes \
    --clean --if-exists \
    --no-owner --role=postgres \
    -j 4 \
    -v /tmp/visual-notes.dump
```
