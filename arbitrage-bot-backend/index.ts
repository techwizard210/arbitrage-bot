import { Wallet } from '@ethersproject/wallet'
import {
  TransactionReceipt,
  TransactionResponse,
  WebSocketProvider,
} from '@ethersproject/providers'
import { formatEther, formatUnits, parseEther } from '@ethersproject/units'
import Sever from 'bunrest'
import { ArbAggregator } from 'lib/ArbFactory'
import BscData from 'data/bsc.json'

import {
  init,
  getParameters,
  setParameter,
  getBotHistories,
  addBotHistory,
} from './lib/database'

init()
// initializeParameter();

const config = {
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  DEX_SCREENER_API: process.env.DEX_SCREENER_API,
  TARGET_TOKEN_ADDRESS: process.env.TARGET_TOKEN_ADDRESS,
  TARGET_TOKEN_SYMBOL: process.env.TARGET_TOKEN_SYMBOL,
  BLOCKCHAIN_PROVIDER: process.env.BLOCKCHAIN_PROVIDER,
  TARGET_TOKEN_DECIMAL: process.env.TARGET_TOKEN_DECIMAL,
  WEBSOCKET_PROVIDER: process.env.WEBSOCKET_PROVIDER,
  ARB_CONTRACT: process.env.ArbContract,
}
let baseTokenAddress = BscData.baseAssets[0]
let botinterval
const provider = new WebSocketProvider(config.WEBSOCKET_PROVIDER)
const signer = new Wallet(config.PRIVATE_KEY, provider)

const arbContract = ArbAggregator.connect(config.ARB_CONTRACT, signer)

// API Endpoints
const app = Sever()

const startBot = (_config) => {
  console.log('Starting bot...')
  botinterval = setInterval(async () => {
    let max = 0
    let min = Math.pow(10, 5)
    let min_index = 0 // best sell dex
    let max_index = 0 // best buy dex
    for (let i = 0; i < BscData.routers.length; i++) {
      try {
        const amtBack = await arbContract.getAmountOutMin(
          BscData.routers[i].address,
          baseTokenAddress.address,
          config.TARGET_TOKEN_ADDRESS,
          parseEther(_config.bnb_amount.toString()),
        )
        const output = formatUnits(amtBack, config.TARGET_TOKEN_DECIMAL)
        // find best dexs for buying and selling
        if (parseFloat(output) > max) {
          max = parseFloat(output)
          max_index = i
        }
        if (parseFloat(output) < min) {
          min = parseFloat(output)
          min_index = i
        }
      } catch {
        continue
      }
    }

    // check if the profit is greater than desired amount
    if (min_index !== max_index) {
      try {
        // Estimate actual output amount
        const amtBack = await arbContract.estimateDualDexTrade(
          BscData.routers[max_index].address,
          BscData.routers[min_index].address,
          baseTokenAddress.address,
          config.TARGET_TOKEN_ADDRESS,
          parseEther(_config.bnb_amount.toString()),
        )
        // convert output amount into human readable value.
        const output = formatEther(amtBack)
        if (
          parseFloat(output) - _config.bnb_amount >
          (_config.bnb_amount * _config.profit) / 100
        ) {
          console.log('Starting bot transaction...')
          const tx: TransactionResponse = await arbContract
            .dualTrade(
              BscData.routers[max_index].address,
              BscData.routers[min_index].address,
              baseTokenAddress.address,
              config.TARGET_TOKEN_ADDRESS,
              parseEther(_config.bnb_amount.toString()),
            )
            .send({
              gasLimit: _config.gas_limit,
              gasPrice: _config.gas_price,
            })
          const result: TransactionReceipt = await tx.wait()

          addBotHistory({
            txHash: result.transactionHash,
            dex_from: BscData.routers[max_index].dex,
            dex_to: BscData.routers[min_index].dex,
            base_token: baseTokenAddress.sym,
            target_token: config.TARGET_TOKEN_SYMBOL,
            amount_in: _config.bnb_amount,
            amount_out: parseFloat(output),
            profit: (parseFloat(output) / _config.bnb_amount) * 100,
            gas_used: parseInt(result.gasUsed.toString()),
            datetime: new Date('yyyy-mm-dd HH:ii:ss'),
          })
        }
      } catch {
        console.log('failed to execute transaction.')
      }
    }
  }, parseInt(_config.timelimit) * 1000)
}

// get bot parameters
app.get('/api/get_config', (req, res) => {
  const result = getParameters()
  res.status(200).json(result)
})

app.get('/api/get_target_token', (req, res) => {
  console.log('requested to get target token info')
  res.status(200).json({
    address: config.TARGET_TOKEN_ADDRESS,
    symbol: config.TARGET_TOKEN_SYMBOL,
    decimal: config.TARGET_TOKEN_DECIMAL,
  })
})

app.get('/api/get_base_token', (req, res) => {
  console.log('requested to get target token info')
  res.status(200).json(BscData.baseAssets)
})

app.post('/api/save_config', async (req, res) => {
  console.log(await req.text())
  setParameter(JSON.parse(await req.text()))
  if (botinterval) clearInterval(botinterval)
  const config = getParameters()
  startBot(config)
  res.status(200).json({ message: 'succeed' })
})

app.post('/api/change_base_token', async (req, res) => {
  console.log(await req.text())
  const params = JSON.parse(await req.text())
  baseTokenAddress = BscData.baseAssets.filter(
    (basetoken) => basetoken.sym == params.token,
  )[0]

  const bot_config = getParameters()
  if (botinterval) clearInterval(botinterval)
  startBot(bot_config)

  res.status(200).json({ message: 'succeed' })
})
app.get('/api/get_bot_histories', (req, res) => {
  const histories = getBotHistories()
  // setParameter(req.body);
  if (histories.length > 0) {
    res.status(200).json(histories)
  } else {
    res.status(200).json({})
  }
})
app.listen(3001, () => {
  console.log('App is listening on port 3001')
})

console.log('Hello via Bun!')

if (botinterval) clearInterval(botinterval)
const botConfig = getParameters()
startBot(botConfig)
