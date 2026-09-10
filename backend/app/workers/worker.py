import asyncio
import logging
import os


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run() -> None:
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    host_port = redis_url.removeprefix("redis://").split("/", 1)[0]
    host, port_text = host_port.split(":", 1)
    port = int(port_text)
    while True:
        reader, writer = await asyncio.open_connection(host, port)
        writer.write(b"*1\r\n$4\r\nPING\r\n")
        await writer.drain()
        await reader.read(16)
        writer.close()
        await writer.wait_closed()
        await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(run())
