import sys
import glob

files = glob.glob(".github/workflows/*.yml")

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()

    # Replace lts/* with 24
    if "node-version: lts/*" in content:
        content = content.replace("node-version: lts/*", "node-version: 24")
        with open(file_path, "w") as f:
            f.write(content)
        print(f"Patched {file_path}")
    else:
        print(f"No match found in {file_path}")
