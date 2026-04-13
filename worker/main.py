import time


def main():
    print("PulseCheck worker started")
    while True:
        print("Worker waiting for services to monitor...")
        time.sleep(30)


if __name__ == "__main__":
    main()
