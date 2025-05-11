import os
import requests
import time
from dotenv import load_dotenv

# Load API key from .env file
load_dotenv()
API_KEY = os.getenv("DUNE_API_KEY")

if not API_KEY:
    raise ValueError("DUNE_API_KEY not found in .env file")

# Replace with your actual query ID
QUERY_ID = 5110969

# Define the parameters for the query
parameters = {
    "query_parameters": {
        "blockchain_name": "ethereum",
        "number_of_days": 7
    },
    "performance": "medium"
}

# Set up headers for authentication and content type
headers = {
    "X-Dune-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Step 1: Execute the query
execute_response = requests.post(
    f"https://api.dune.com/api/v1/query/{QUERY_ID}/execute",
    json=parameters,
    headers=headers
)

if execute_response.status_code != 200:
    print(f"Failed to execute query: {execute_response.text}")
    exit()

execution_id = execute_response.json()["execution_id"]
print(f"Execution ID: {execution_id}")

# Step 2: Poll for query execution status
status = "QUERY_STATE_PENDING"
while status == "QUERY_STATE_PENDING":
    time.sleep(5)  # Wait for 5 seconds before checking the status again
    status_response = requests.get(
        f"https://api.dune.com/api/v1/execution/{execution_id}/status",
        headers=headers
    )
    if status_response.status_code != 200:
        print(f"Failed to get execution status: {status_response.text}")
        exit()
    status = status_response.json()["state"]
    print(f"Current status: {status}")

if status != "QUERY_STATE_COMPLETED":
    print(f"Query execution failed or was canceled. Final status: {status}")
    exit()

# Step 3: Retrieve the results
result_response = requests.get(
    f"https://api.dune.com/api/v1/execution/{execution_id}/results",
    headers=headers
)

if result_response.status_code != 200:
    print(f"Failed to retrieve results: {result_response.text}")
    exit()

results = result_response.json()["result"]["rows"]

# Step 4: Process the results
print("Results:")
for row in results:
    print(row)

