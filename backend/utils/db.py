import os
import psycopg2
from dotenv import load_dotenv

# Debug: Check if .env file exists
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
print(f"Looking for .env file at: {env_path}")
print(f"File exists: {os.path.exists(env_path)}")

load_dotenv(env_path)

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'aiplanet')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASS = os.getenv('DB_PASS', 'password')

# Debug prints
print(f"DB_HOST: {DB_HOST}")
print(f"DB_PORT: {DB_PORT}")
print(f"DB_NAME: {DB_NAME}")
print(f"DB_USER: {DB_USER}")
print(f"DB_PASS: {DB_PASS}")

def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )
    return conn 