// Opts the agent's wallet in to Test USDC.
//
//   npm run agent:optin
//
// This has to run here rather than in Pera, because an opt-in must be signed
// by the account being opted in - and the agent's key lives on the server, not
// in anyone's wallet. It is a 0-amount transfer from the account to itself,
// which is how Algorand records "this account is willing to hold this asset".
//
// Safe to run twice: if it is already opted in, it says so and stops.

import algosdk from 'algosdk'
import { getAgentAccount, getAgentBalance } from '../src/services/agentWallet.js'

const ALGOD = 'https://testnet-api.algonode.cloud'
const USDC = 10458941

async function main() {
  const { address, signer } = getAgentAccount()
  console.log(`\nAgent wallet: ${address}`)

  const balance = await getAgentBalance()

  if (!balance?.exists) {
    console.log('\n✕ This account has no ALGO yet, so it does not exist on chain.')
    console.log('  Send it at least 0.3 ALGO, then run this again.\n')
    process.exitCode = 1
    return
  }

  console.log(`ALGO: ${balance.algo.toFixed(3)}`)

  if (balance.optedIn) {
    console.log(`USDC: already opted in (balance ${balance.usdc})\n`)
    return
  }

  // 0.1 ALGO is locked as minimum balance per asset, plus the fee.
  if (balance.algo < 0.2) {
    console.log(`\n✕ Needs at least 0.2 ALGO to hold an asset. It has ${balance.algo}.\n`)
    process.exitCode = 1
    return
  }

  console.log(`\nOpting in to asset ${USDC}…`)

  const algod = new algosdk.Algodv2('', ALGOD, '')
  const suggestedParams = await algod.getTransactionParams().do()

  // An opt-in is a transfer of zero, from the account to itself.
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: USDC,
    suggestedParams,
  })

  const signed = txn.signTxn(signer.sk)
  const txId = txn.txID()

  await algod.sendRawTransaction(signed).do()
  const confirmation = await algosdk.waitForConfirmation(algod, txId, 6)

  console.log(`✓ Opted in. Transaction ${txId}`)
  console.log(`  Confirmed in round ${confirmation.confirmedRound}`)
  console.log(`  https://lora.algokit.io/testnet/transaction/${txId}`)
  console.log('\nThe agent can now receive and spend Test USDC.\n')
}

await main()
