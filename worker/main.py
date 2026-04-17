import time

from sqlalchemy import text

from db.base import engine


def verify_db():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection verified.")
    except Exception as e:
        print(f"ERROR: Cannot connect to database: {e}")
        raise


def main():
    print("PulseCheck worker started")
    verify_db()
    while True:
        print("Worker waiting for services to monitor...")
        time.sleep(30)


if __name__ == "__main__":
    main()
