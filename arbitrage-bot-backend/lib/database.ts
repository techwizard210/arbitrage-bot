import { Database } from "bun:sqlite";
const db = new Database("arb_bot.db");

export const init = () => {
  db.run(
    "CREATE TABLE IF NOT EXISTS configs (id INTEGER PRIMARY KEY AUTOINCREMENT, slippage REAL, gas_price INTEGER, gas_limit INTEGER, profit REAL, liquidity INTEGER, time_limit INTEGER, bnb_amount REAL)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS bot_histories (id INTEGER PRIMARY KEY AUTOINCREMENT, txHash TEXT, dex_from TEXT, dex_to TEXT, base_token TEXT, target_token TEXT, amount_in REAL, amount_out REAL, profit REAL, gas_used INTEGER datetime TEXT)"
  )
};

export const initializeParameter = () => {
  db.run(
    "INSERT INTO configs (slippage, gas_price, gas_limit, profit, liquidity, time_limit, bnb_amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
    10,
    5,
    200000,
    0.1,
    1000000,
    2,
    0.1
  );
};

export const getParameters = () => {
  return db.query("select * from configs").get();
};

export const setParameter = ({
  slippage,
  gas_price,
  gas_limit,
  profit,
  liquidity,
  time_limit,
  bnb_amount,
}) => {
  db.run(
    "UPDATE configs SET (slippage = '" +
      slippage +
      "', gas_price='" +
      gas_price +
      "', gas_limit='" +
      gas_limit +
      "', profit='" +
      profit +
      "'" +
      "', liquidity='" +
      liquidity +
      "'" +
      "', time_limit='" +
      time_limit +
      "'" +
      "', bnb_amount='" +
      bnb_amount +
      "' WHERE id='1'"
  );
};

export const addBotHistory = (history) => {
  db.run(
    "INSERT INTO bot_histories (txHash, dex_from, dex_to, base_token, target_token, amount_in, amount_out, profit, gas_used, datetime) VALUES (?, ?, ?, ?, ?, ?, ?)",
    history.txHash,
    history.dex_from,
    history.dex_to,
    history.base_token,
    history.target_token,
    history.amount_in,
    history.amount_out,
    history.profit,
    history.gas_used,
    history.datetime
  );
}

export const getBotHistories = () => {
  return db.query("select * from bot_histories").all();
}