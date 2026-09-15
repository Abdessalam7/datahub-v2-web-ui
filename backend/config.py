from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    cos_endpoint_url: str
    cos_access_key_id: str
    cos_secret_access_key: str
    cos_region: str
    cos_bucket_name: str

    class Config:
        env_file = ".env"

settings = Settings()
