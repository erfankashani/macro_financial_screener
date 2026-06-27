#!/usr/bin/env bash
# Launch the Next.js dev server using the conda NodeEnv toolchain.
set -e
export PATH="$HOME/mambaforge/envs/NodeEnv/bin:$PATH"
cd "$(dirname "$0")/../frontend"
exec npm run dev -- -p 3000
