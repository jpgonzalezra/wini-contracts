#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

ganache_port=8545

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
  # We define 5 accounts with balance 1M ether, needed for high-value tests.
  local accounts=(
    --account="0xced26e4f0ad256777efa4b205ac3003eca7e1befb9f657be58600b7115a6cdf1,1000000000000000000000000"
    --account="0x3132ce18b38230af1f8d751f5658c97e59d33a9e884676fddfc9cc4434cd36fb,1000000000000000000000000"
    --account="0x087df46b73931fd31751e80a203bb6be011f3ab2cf1930b2a92db901f0fdffc6,1000000000000000000000000"
    --account="0xeb558208fc7e52bc018d11414e6e624d0ab44a7cb63dfad9d75f913b45268746,1000000000000000000000000"
    --account="0xde43de7119a20ee767b39b926058096f95812058ed1c078f35269b5c788a33cf,1000000000000000000000000"
  )

  npx ganache-cli --gasLimit 0xfffffffffff --port "$ganache_port" "${accounts[@]}" > /dev/null &
  ganache_pid=$!

  echo "Waiting for ganache to launch on port "$ganache_port"..."

  while ! ganache_running; do
    sleep 0.1 # wait for 1/10 of the second before check again
  done

  echo "Ganache launched!"
}

if ganache_running; then
  echo "Using existing ganache instance"
else
  echo "Starting our own ganache instance"
  start_ganache
fi

npx truffle version
npx truffle test "$@"
