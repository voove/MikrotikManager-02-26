from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from app.core.config import settings

_client = InfluxDBClient(
    url=settings.INFLUX_URL,
    token=settings.INFLUX_TOKEN,
    org=settings.INFLUX_ORG,
)

write_api = _client.write_api(write_options=SYNCHRONOUS)
query_api = _client.query_api()


def get_write_api():
    return write_api


def get_query_api():
    return query_api
