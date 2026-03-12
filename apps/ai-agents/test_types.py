import asyncio
import os
from notebooklm import NotebookLMClient

async def test():
    path = os.path.expanduser("~/.notebooklm/storage_state.json")
    if not os.path.exists(path):
        print("Auth file missing")
        return
    
    ctx = await NotebookLMClient.from_storage(path)
    print(f"Ctx type: {type(ctx)}")
    client = await ctx.__aenter__()
    print(f"Client type: {type(client)}")
    print(f"Has chat: {hasattr(client, 'chat')}")
    await ctx.__aexit__(None, None, None)

if __name__ == "__main__":
    asyncio.run(test())
