import os
os.environ["NO_PROXY"] = "s3.direct.eu-fr2.cloud-object-storage.appdomain.cloud"

import json
from datetime import datetime, timedelta, timezone
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from functools import lru_cache
from config import settings


@lru_cache(maxsize=1)
def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.cos_endpoint_url,
        aws_access_key_id=settings.cos_access_key_id,
        aws_secret_access_key=settings.cos_secret_access_key,
        region_name=settings.cos_region,
    )

def fetch_status_from_cos(tech: str) -> dict:
    key = f"monitoring-web/input/{tech}/status.json"
    try:
        client = get_s3_client()
        response = client.get_object(Bucket=settings.cos_bucket_name, Key=key)
        content = response["Body"].read().decode("utf-8")
        return json.loads(content)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        raise RuntimeError(f"COS ClientError [{code}] for key '{key}': {e.response['Error']['Message']}")
    except BotoCoreError as e:
        raise RuntimeError(f"COS connection error: {str(e)}")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in '{key}': {str(e)}")

def fetch_history_from_cos(tech: str, days: int = 30) -> list[dict]:
    """Merge the day-partitioned history files pysmoke-test writes for `tech`.

    Each monitoring-web/history/{tech}/{day}.json is a JSON array of
    {"ts": ..., results_key: [...]} events, only appended when a run's
    results actually changed — so most days have zero or a handful of
    events, not one per check cycle.
    """
    client = get_s3_client()
    today = datetime.now(timezone.utc).date()
    events = []
    for offset in range(days):
        day = today - timedelta(days=offset)
        key = f"monitoring-web/history/{tech}/{day.isoformat()}.json"
        try:
            response = client.get_object(Bucket=settings.cos_bucket_name, Key=key)
            content = response["Body"].read().decode("utf-8")
            day_events = json.loads(content)
            if isinstance(day_events, list):
                events.extend(day_events)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
                continue
            raise RuntimeError(f"COS ClientError [{e.response['Error']['Code']}] for key '{key}': {e.response['Error']['Message']}")
        except BotoCoreError as e:
            raise RuntimeError(f"COS connection error: {str(e)}")
        except json.JSONDecodeError:
            continue

    events.sort(key=lambda e: e.get("ts", ""))
    return events
