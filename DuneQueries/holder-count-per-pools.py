import os
import asyncio
from moralis import evm_api
from dotenv import load_dotenv

# Load API key from .env
load_dotenv()
api_key = os.getenv("MORALIS_API_KEY")
if not api_key:
    raise ValueError("Missing MORALIS_API_KEY in .env")

POOLS = [
    "0xdd439304a77f54b1f7854751ac1169b279591ef7",
    "0xbc2acf5e821c5c9f8667a36bb1131dad26ed64f9",
    "0xbad20c15a773bf03ab973302f61fabcea5101f0a",
    "0x1acd5c5e69dc056649d698046486fb54545ce7e4",
    "0x4683e340a8049261057d5ab1b29c8d840e75695e",
    "0xa9b2234773cc6a4f3a34a770c52c931cba5c24b2",
    "0x71e1179c5e197fa551beec85ca2ef8693c61b85b",
    "0x4cdabe9e07ca393943acfb9286bbbd0d0a310ff6",
    "0xd1d7fa8871d84d0e77020fc28b7cd5718c446522",
    "0x272d6be442e30d7c87390edeb9b96f1e84cecd8d",
    "0x79c872ed3acb3fc5770dd8a0cd9cd5db3b3ac985",
    "0xfc095c811fe836ed12f247bcf042504342b73fb7",
    "0xe2343512dcf8a23d81e6cdc2fac656db1ff83aa1",
    "0x00df7f58e1cf932ebe5f54de5970fb2bdf0ef06d",
    "0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655",
    "0x8dd4df4ce580b9644437f3375e54f1ab09808228",
    "0x22d3f4e4dada5d7a3007a58dd191897ad8578160",
    "0xc9f00c3a713008ddf69b768d90d4978549bfdf94",
    "0x06135a9ae830476d3a941bae9010b63732a055f4",
    "0x8189c4c96826d016a99986394103dfa9ae41e7ee",
    "0xae2a38545167be5a2eba9b931b28de5a7d95315e",
    "0x2086f52651837600180de173b09470f54ef74910",
    "0xaa56989be5e6267fc579919576948db3e1f10807",
    "0xa99fd9950b5d5dceeaf4939e221dca8ca9b938ab",
    "0x263a6edafa6444dc2ae550f9eff6344c1686d6aa",
    "0x3220c83e953186f2b9ddfc0b5dd69483354edca2",
    "0x0a24f8a142fec1c3da01398d2f4dda168443a915",
    "0x388cae2f7d3704c937313d990298ba67d70a3709",
    "0xe89023c28eb5f7079f88a284546dec8fb8c3cd02",
    "0x5c78d05b8ecf97507d1cf70646082c54faa4da95"
]


async def main():
    results = []

    for token_address in POOLS:
        try:
            response = evm_api.token.get_token_owners(
                api_key=api_key,
                params={
                    "chain": "0x64",  # Gnosis Chain
                    "token_address": token_address
                }
            )
            holders = len(response['result'])
            results.append({"tokenAddress": token_address, "holders": holders})
        except Exception as e:
            print(f"Error fetching holders for {token_address}: {e}")

    # Sort by fewest holders
    results.sort(key=lambda x: x["holders"])

    print("\nPools ranked by fewest holders:\n")
    for i, item in enumerate(results, 1):
        print(f"#{i}: {item['tokenAddress']} — {item['holders']} holders")

if __name__ == "__main__":
    asyncio.run(main())

