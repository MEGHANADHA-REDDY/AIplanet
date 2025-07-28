import psycopg2
from utils.db import get_db_connection

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL,
            upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'uploaded'
        );
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS workflows (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            definition JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS chatlogs (
            id SERIAL PRIMARY KEY,
            workflow_id INTEGER REFERENCES workflows(id),
            user_message TEXT NOT NULL,
            bot_response TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS execution_logs (
            id SERIAL PRIMARY KEY,
            workflow_id INTEGER REFERENCES workflows(id),
            query TEXT NOT NULL,
            response TEXT NOT NULL,
            model_used TEXT NOT NULL,
            success BOOLEAN NOT NULL,
            error TEXT,
            execution_time FLOAT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    init_db() 