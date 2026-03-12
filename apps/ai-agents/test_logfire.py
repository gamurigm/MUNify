# pyre-ignore-all-errors
from dotenv import load_dotenv  # pyre-ignore
import os
import logfire  # pyre-ignore

load_dotenv()
logfire.configure(send_to_logfire=True)
logfire.info("Hello Logfire Test!")
print("Sent")
