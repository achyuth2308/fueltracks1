su - postgres -c '
TS=$(date +%F_%H-%M)
pg_dump fueltracks | gzip > /var/lib/postgresql/fueltracks_pre_batch2_$TS.sql.gz
ls -la /var/lib/postgresql/fueltracks_pre_batch2_$TS.sql.gz
psql -d fueltracks -c "SELECT (SELECT count(*) FROM gps_points) as gps_points, (SELECT count(*) FROM vehicles) as vehicles, (SELECT count(*) FROM alerts) as alerts;"
'
