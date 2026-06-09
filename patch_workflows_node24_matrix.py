import sys

file_path = ".github/workflows/CI.yml"
with open(file_path, "r") as f:
    content = f.read()

search = "node-version: [ lts/*, 24, latest ]"
replace = "node-version: [ 24, latest ]"

if search in content:
    content = content.replace(search, replace)
    with open(file_path, "w") as f:
        f.write(content)
    print("Patch applied to matrix in CI.yml.")
