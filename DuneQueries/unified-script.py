import os
import sys
import time
import requests
import asyncio
from dotenv import load_dotenv
from moralis import evm_api
import json

# Load API keys
load_dotenv()
DUNE_API_KEY = os.getenv("DUNE_API_KEY")
MORALIS_API_KEY = os.getenv("MORALIS_API_KEY")

if not DUNE_API_KEY:
    raise ValueError("DUNE_API_KEY not found in .env")
if not MORALIS_API_KEY:
    raise ValueError("MORALIS_API_KEY not found in .env")

# -------------------- DUNE QUERY --------------------
QUERY_ID = 5110969
dune_headers = {
    "X-Dune-API-Key": DUNE_API_KEY,
    "Content-Type": "application/json"
}
dune_parameters = {
    "query_parameters": {
        "blockchain_name": "gnosis",
        "number_of_days": int(sys.argv[1] if len(sys.argv) > 1 else 7)
    },
    "performance": "medium"
}

# Step 1: Execute the Dune query
execute_response = requests.post(
    f"https://api.dune.com/api/v1/query/{QUERY_ID}/execute",
    json=dune_parameters,
    headers=dune_headers
)
if execute_response.status_code != 200:
    raise RuntimeError(f"Failed to execute Dune query: {execute_response.text}")

execution_id = execute_response.json()["execution_id"]
print(f"Execution ID: {execution_id}")

# Step 2: Poll for Dune query completion
while True:
    time.sleep(5)
    status_response = requests.get(
        f"https://api.dune.com/api/v1/execution/{execution_id}/status",
        headers=dune_headers
    )
    status = status_response.json()["state"]
    print(f"Status: {status}")
    if status == "QUERY_STATE_COMPLETED":
        break
    elif status in ("QUERY_STATE_FAILED", "QUERY_STATE_CANCELLED", "QUERY_STATE_TIMED_OUT"):
        raise RuntimeError(f"Dune query failed or was canceled: {status}")

# Step 3: Get Dune result
result_response = requests.get(
    f"https://api.dune.com/api/v1/execution/{execution_id}/results",
    headers=dune_headers
)
if result_response.status_code != 200:
    raise RuntimeError(f"Failed to get Dune results: {result_response.text}")

results = result_response.json()["result"]["rows"]
pool_addresses = [row["project_contract_address"].lower() for row in results]

# -------------------- MORALIS LOOKUP --------------------

def is_valid_address(address):
    """Check if the address is a valid Ethereum address."""
    return address.startswith('0x') and len(address) == 42

def is_token_indexed(token_address):
    if not is_valid_address(token_address):
        print(f"Invalid token address format: {token_address}")
        return False
        
    try:
        response = evm_api.token.get_token_metadata(
            api_key=MORALIS_API_KEY,
            params={
                "chain": "gnosis",
                "addresses": [token_address]
            }
        )
        return len(response) > 0
    except Exception as e:
        print(f"Error checking token metadata for {token_address}: {str(e)}")
        return False

async def fetch_holders(token_address, retries=3, delay=1):
    if not is_valid_address(token_address):
        print(f"Invalid token address format: {token_address}")
        return None
        
    for attempt in range(retries):
        try:
            print(f"Attempting to fetch holders for {token_address} (attempt {attempt + 1}/{retries})")
            response = evm_api.token.get_token_owners(
                api_key=MORALIS_API_KEY,
                params={
                    "chain": "0x64",
                    "token_address": token_address,
                    "limit": 10
                }
            )
            
            if "result" not in response:
                print(f"Unexpected response format for {token_address}: {json.dumps(response, indent=2)}")
                return None
                
            holders_count = len(response["result"])
            print(f"Successfully fetched {holders_count} holders for {token_address}")
            return holders_count
            
        except Exception as e:
            error_msg = str(e)
            print(f"Attempt {attempt + 1} failed for {token_address}:")
            print(f"Error: {error_msg}")
            
            # If we have a response object, print more details
            if hasattr(e, 'response'):
                print(f"Status code: {e.response.status_code}")
                print(f"Response headers: {dict(e.response.headers)}")
                try:
                    print(f"Response body: {e.response.text}")
                except:
                    pass
            
            if attempt < retries - 1:
                wait_time = delay * (attempt + 1)
                print(f"Waiting {wait_time} seconds before retrying...")
                await asyncio.sleep(wait_time)
            else:
                print(f"All {retries} attempts failed for {token_address}")
                return None
    return None

async def main():
    print(f"\nFetching holders for {len(pool_addresses)} pools from Moralis...")
    moralis_results = []
    failed_addresses = []

    for token_address in pool_addresses:
        if not is_valid_address(token_address):
            print(f"Skipped {token_address}: invalid address format")
            failed_addresses.append({"address": token_address, "reason": "Invalid address format"})
            continue

        if not is_token_indexed(token_address):
            print(f"Skipped {token_address}: not indexed on Moralis")
            failed_addresses.append({"address": token_address, "reason": "Not indexed on Moralis"})
            continue

        holders = await fetch_holders(token_address)
        if holders is not None:
            moralis_results.append({
                "tokenAddress": token_address,
                "holders": holders
            })
        else:
            failed_addresses.append({"address": token_address, "reason": "Failed to fetch holders"})
        
        # Add a small delay between requests to avoid rate limiting
        await asyncio.sleep(1)

    # Sort results by holder count
    moralis_results.sort(key=lambda x: x["holders"])

    print("\nPools ranked by fewest holders:\n")
    for i, item in enumerate(moralis_results, 1):
        print(f"#{i}: {item['tokenAddress']} — {item['holders']} holders")

    if failed_addresses:
        print("\nFailed addresses:")
        for failed in failed_addresses:
            print(f"- {failed['address']}: {failed['reason']}")

    # Save results to a JSON file
    with open('pool_data.json', 'w') as f:
        json.dump(moralis_results, f, indent=4)

if __name__ == "__main__":
    asyncio.run(main())

