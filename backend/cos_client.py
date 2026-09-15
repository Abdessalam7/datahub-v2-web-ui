import os
os.environ["NO_PROXY"] = "s3.direct.eu-fr2.cloud-object-storage.appdomain.cloud"

import json
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
