import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("      Dolly POS Central Cloud Hub (Development Mode)")
    print("      Running on: http://0.0.0.0:8001")
    print("=" * 60)
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
