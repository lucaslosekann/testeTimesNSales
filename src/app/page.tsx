"use client"
import axios from "axios";
import Image from "next/image";
import { useEffect, useState } from "react";

export type Data = Root2[]

export interface Root2 {
  day: Day
  details: Details
  greeks: Greeks
  implied_volatility?: number
  last_quote: LastQuote
  last_trade: LastTrade
  open_interest: number
  underlying_asset: UnderlyingAsset
}

export interface Day {
  change?: number
  change_percent?: number
  close?: number
  high?: number
  last_updated?: number
  low?: number
  open?: number
  previous_close?: number
  volume?: number
  vwap?: number
}

export interface Details {
  contract_type: string
  exercise_style: string
  expiration_date: string
  shares_per_contract: number
  strike_price: number
  ticker: string
}

export interface Greeks {
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
}

export interface LastQuote {
  ask: number
  ask_size: number
  ask_exchange: number
  bid: number
  bid_size: number
  bid_exchange: number
  last_updated: number
  midpoint: number
  timeframe: string
}

export interface LastTrade {
  sip_timestamp?: number
  conditions?: number[]
  price?: number
  size?: number
  exchange?: number
  timeframe?: string
}

export interface UnderlyingAsset {
  last_updated: number
  value: number
  ticker: string
  timeframe: string
}


export default function Home() {
  const [data, setData] = useState<{
    content: Root2,
    type: "buy" | "sell" | "trade"
  }[]>([])

  const [live, setLive] = useState(true)

  async function fetchData() {
    axios.get<Data>("https://api-data.quanticocap.com/price/I:SPX").then((res) => {
      let content: {
        content: Root2,
        type: "buy" | "sell" | "trade"
      }[] = []

      res.data.map((item) => {
        if (item.last_trade.price && item.last_trade.sip_timestamp) {
          if (item.last_trade.price >= item.last_quote.ask) {
            content.push({
              type: "buy",
              content: item
            })
          } else if (item.last_trade.price <= item.last_quote.bid) {
            content.push({
              type: "sell",
              content: item
            })
          } else {
            content.push({
              type: "trade",
              content: item
            })
          }
        }
      })

      setData(content)

    })
  }

  useEffect(() => {

    const interval = setInterval(() => {
      if (live)
        fetchData()
    }, 10000)

    return () => clearInterval(interval)
  }, [live])

  return (
    <main>
      {/* table with time, type, price and size */}
      <button onClick={() => {
        setLive(live => !live)
      }}>
        {
          live ? "Stop" : "Start"
        }
      </button>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Trade</th>
            <th>Size</th>
            <th>Strike</th>
            <th>Price</th>
            <th>Type</th>
            <th>Spot</th>
          </tr>
        </thead>
        <tbody>
          {data
            .sort((a, b) => {
              return (b.content.last_trade.sip_timestamp ?? 0) - (a.content.last_trade.sip_timestamp ?? 0)
            })
            .map((item, index) => (
              <tr key={index} style={{
                backgroundColor: item.type === "buy" ? "green" : item.type === "sell" ? "red" : "transparent",
                color: item.type === "buy" ? "white" : item.type === "sell" ? "white" : "white"
              }}>
                <td>{new Date((item.content.last_trade.sip_timestamp ?? 0) / 1000000).toLocaleString([], {
                  timeZone: "America/New_York",
                })}</td>
                <td>{item.type.toUpperCase()}</td>
                <td>{item.content.last_trade.size}</td>
                <td>{item.content.details.strike_price}</td>
                <td>{item.content.last_trade.price}</td>
                <td>{item.content.details.contract_type.toUpperCase()}</td>
                <td>{
                  item.type == "buy" && item.content.details.contract_type == "call" ? "📈" :
                    item.type == "sell" && item.content.details.contract_type == "call" ? "📉" :
                      item.type == "buy" && item.content.details.contract_type == "put" ? "📉" :
                        item.type == "sell" && item.content.details.contract_type == "put" ? "📈" : ""

                }</td>
              </tr>
            ))}
        </tbody>
      </table>
    </main>
  );
}
