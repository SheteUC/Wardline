from pydantic_settings import BaseSettings
from pydantic import Field

class Test(BaseSettings):
    endpoint: str = Field(default='', env='AZURE_EXISTING_AIPROJECT_ENDPOINT')
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'

t = Test()
print(f'Pydantic endpoint: [{t.endpoint}]')
print(f'Length: {len(t.endpoint)}')
