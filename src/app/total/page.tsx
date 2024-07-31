"use client"
import axios from "axios";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import PlotlyTemplate from "./PlotlyTemplate";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false, })


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


const PRICE_RANGE = 50

export default function Home() {
    const [data, setData] = useState<{
        content: Root2,
        type: "buy" | "sell" | "trade"
    }[]>([])

    const [live, setLive] = useState(true)

    async function fetchData() {
        return axios.get<Data>("https://api-data.quanticocap.com/price/I:SPX").then((res) => {
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
                } else {
                    console.log(item)
                }
            })

            setData(content)

        })
    }

    useEffect(() => {
        let isCancelled = false;


        async function fetch() {
            for (; !isCancelled && live;) {
                if (live && !isCancelled) {
                    await fetchData()
                }
            }
        }


        fetch()

        return () => {
            isCancelled = true
        }

    }, [live])

    const sums = data.reduce<{
        up: number
        down: number
    }>(({ up, down }, curr) => {
        const direction: "up" | "down" | "none" = curr.type == "buy" && curr.content.details.contract_type == "call" ? "up" :
            curr.type == "sell" && curr.content.details.contract_type == "call" ? "down" :
                curr.type == "buy" && curr.content.details.contract_type == "put" ? "down" :
                    curr.type == "sell" && curr.content.details.contract_type == "put" ? "up" : "none"

        if (direction == "up") {
            up += curr.content.last_trade.size ?? 0
        } else if (direction == "down") {
            down += curr.content.last_trade.size ?? 0
        }

        return {
            up,
            down
        }
    }, {
        up: 0,
        down: 0
    })


    let formattedData = data.sort((a, b) => {
        return (b.content.last_trade.sip_timestamp ?? 0) - (a.content.last_trade.sip_timestamp ?? 0)
    })
        .filter((item) => {
            return item.content.details.strike_price > item.content.underlying_asset.value - PRICE_RANGE && item.content.details.strike_price < item.content.underlying_asset.value + PRICE_RANGE
        })



    return (
        <main>
            {/* table with time, type, price and size */}
            <div className="flex gap-2">
                <button onClick={() => {
                    setLive(live => !live)
                }}>
                    {
                        live ? "Stop" : "Start"
                    }
                </button>
                <div>
                    {
                        formattedData[0]?.content.underlying_asset.value.toFixed(2)
                    }
                </div>

                <div style={{
                    background: sums.up > sums.down ? "green" : sums.up < sums.down ? "red" : "transparent",
                }} className="p-2">
                    Up: {(sums.up / (sums.up + sums.down) * 100).toFixed(2)}%({sums.up}) Down: {(sums.down / (sums.up + sums.down) * 100).toFixed(2)}%({sums.down})
                </div>

            </div>
            <div className="flex gap-2">
                <TotalTable formattedData={formattedData} strikes={formattedData.map(i => i.content.details.strike_price)} />

            </div>
        </main>
    );
}




function NormalTable({
    formattedData
}: {
    formattedData: {
        content: Root2,
        type: "buy" | "sell" | "trade"
    }[]
}) {
    return <table>
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
            {formattedData
                .map((item, index) => {
                    const direction: "up" | "down" | "none" = item.type == "buy" && item.content.details.contract_type == "call" ? "up" :
                        item.type == "sell" && item.content.details.contract_type == "call" ? "down" :
                            item.type == "buy" && item.content.details.contract_type == "put" ? "down" :
                                item.type == "sell" && item.content.details.contract_type == "put" ? "up" : "none"

                    return (
                        <tr key={index} style={{
                            backgroundColor: direction === "up" ? "green" : direction === "down" ? "red" : "transparent",
                            color: direction === "up" ? "white" : direction === "down" ? "white" : "white"
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
                                direction == "up" ? "📈" :
                                    direction == "down" ? "📉" : ""
                            }</td>
                        </tr>
                    )
                })}
        </tbody>
    </table>
}

function AggregatesTable({
    formattedData,
    strikes
}: {
    formattedData: {
        content: Root2,
        type: "buy" | "sell" | "trade"
    }[]
    strikes: number[]
}) {

    const data = formattedData
        .reduce<{
            [key: number]: {
                up: number
                down: number
                trade: number
                call: number
                put: number
            }
        }>((prev, curr) => {
            const direction: "up" | "down" | "none" = curr.type == "buy" && curr.content.details.contract_type == "call" ? "up" :
                curr.type == "sell" && curr.content.details.contract_type == "call" ? "down" :
                    curr.type == "buy" && curr.content.details.contract_type == "put" ? "down" :
                        curr.type == "sell" && curr.content.details.contract_type == "put" ? "up" : "none"
            if (!prev[curr.content.details.strike_price]) {
                prev[curr.content.details.strike_price] = {
                    up: 0,
                    down: 0,
                    trade: 0,
                    call: 0,
                    put: 0
                }
            }


            if (direction == "up") {
                prev[curr.content.details.strike_price].up += curr.content.last_trade.size ?? 0
            } else if (direction == "down") {
                prev[curr.content.details.strike_price].down += curr.content.last_trade.size ?? 0
            } else {
                prev[curr.content.details.strike_price].trade += curr.content.last_trade.size ?? 0
                if (curr.content.details.contract_type == "call") {
                    prev[curr.content.details.strike_price].call += curr.content.last_trade.size ?? 0
                } else if (curr.content.details.contract_type == "put") {
                    prev[curr.content.details.strike_price].put += curr.content.last_trade.size ?? 0
                }
            }






            return prev;
        }, {} as {
            [key: number]: {
                up: number
                down: number
                trade: number
                call: number
                put: number
            }
        }
        )


    return <table>
        <thead>
            <tr>
                <th>Strikes</th>
                <th>Up</th>
                <th>Down</th>
                <th>Delta</th>
                <th>Call</th>
                <th>Put</th>
            </tr>
        </thead>
        <tbody>
            {
                [... new Set(strikes)]
                    .sort((a, b) => {
                        return b - a
                    })
                    .map((strike, index) => {
                        const item = data[Number(strike)]
                        if (!item) {
                            return <tr key={index} >
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        }

                        const delta = item.up - item.down
                        return (
                            <tr key={index} style={{
                                backgroundColor: delta > 0 ? "green" : delta < 0 ? "red" : "transparent",
                                color: delta > 0 ? "white" : delta < 0 ? "white" : "white"
                            }}>
                                <td>{strike}</td>
                                <td>{item.up}</td>
                                <td>{item.down}</td>
                                <td>{delta}</td>
                                <td className="bg-black">{item.call}</td>
                                <td className="bg-black">{item.put}</td>
                            </tr>
                        )
                    })}
        </tbody>
    </table>
}

function TotalTable({
    formattedData,
    strikes
}: {
    formattedData: {
        content: Root2,
        type: "buy" | "sell" | "trade"
    }[]
    strikes: number[]
}) {
    const data = formattedData
        .reduce<{
            [key: number]: {
                up: number
                down: number
                trade: number
                call: number
                put: number
            }
        }>((prev, curr) => {
            const direction: "up" | "down" | "none" = curr.type == "buy" && curr.content.details.contract_type == "call" ? "up" :
                curr.type == "sell" && curr.content.details.contract_type == "call" ? "down" :
                    curr.type == "buy" && curr.content.details.contract_type == "put" ? "down" :
                        curr.type == "sell" && curr.content.details.contract_type == "put" ? "up" : "none"
            if (!prev[curr.content.details.strike_price]) {
                prev[curr.content.details.strike_price] = {
                    up: 0,
                    down: 0,
                    trade: 0,
                    call: 0,
                    put: 0
                }
            }


            if (direction == "up") {
                prev[curr.content.details.strike_price].up += curr.content.last_trade.size ?? 0
            } else if (direction == "down") {
                prev[curr.content.details.strike_price].down += curr.content.last_trade.size ?? 0
            } else {
                prev[curr.content.details.strike_price].trade += curr.content.last_trade.size ?? 0
                if (curr.content.details.contract_type == "call") {
                    prev[curr.content.details.strike_price].call += curr.content.last_trade.size ?? 0
                } else if (curr.content.details.contract_type == "put") {
                    prev[curr.content.details.strike_price].put += curr.content.last_trade.size ?? 0
                }
            }






            return prev;
        }, {} as {
            [key: number]: {
                up: number
                down: number
                trade: number
                call: number
                put: number
            }
        }
        )

    const deltas1 = [... new Set(strikes)].sort((a, b) => {
        return b - a
    }).map((strike) => {
        const item = data[Number(strike)]
        const delta = (item.up - item.down) + (item.call - item.put)
        return delta
    })
    const range1 = Math.max(
        ...deltas1,
        Math.abs(Math.min(...deltas1))
    )

    const deltas2 = [... new Set(strikes)].sort((a, b) => {
        return b - a
    }).map((strike) => {
        const item = data[Number(strike)]
        const delta = (item.up - item.down)
        return delta
    })
    const range2 = Math.max(
        ...deltas2,
        Math.abs(Math.min(...deltas2))
    )




    return <div className="flex gap-3">
        {/* <table>
            <thead>
                <tr>
                    <th>Strikes</th>
                    <th>Up/Down</th>
                </tr>
            </thead>
            <tbody>
                {
                    [... new Set(strikes)]
                        .sort((a, b) => {
                            return b - a
                        })
                        .map((strike, index) => {
                            const item = data[Number(strike)]
                            if (!item) {
                                return <tr key={index} >
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            }

                            const delta = (item.up - item.down) + (item.call - item.put)
                            return (
                                <tr key={index} style={{
                                    backgroundColor: delta > 0 ? "green" : delta < 0 ? "red" : "transparent",
                                    color: delta > 0 ? "white" : delta < 0 ? "white" : "white"
                                }}>
                                    <td>{strike}</td>
                                    <td>{delta}</td>
                                </tr>
                            )
                        })}
            </tbody>
        </table> */}
        <Plot
            data={[
                {
                    type: 'bar',
                    x: deltas1,
                    y: [... new Set(strikes)].sort((a, b) => {
                        return b - a
                    }),
                    orientation: 'h',
                    marker: {
                        color: [... new Set(strikes)].sort((a, b) => {
                            return b - a
                        }
                        ).map((strike) => {
                            const item = data[Number(strike)]
                            const delta = (item.up - item.down) + (item.call - item.put)
                            return delta > 0 ? "green" : delta < 0 ? "red" : "transparent"
                        })
                    }

                }
            ]}
            layout={{
                width: 800,
                height: 800,
                template: PlotlyTemplate,
                xaxis: {
                    range: [-range1, range1]


                },
                annotations: [
                    {
                        xref: "paper",
                        x: 0,
                        y: formattedData[0]?.content.underlying_asset.value,
                        xanchor: "left",
                        yanchor: "middle",
                        text: formattedData[0]?.content.underlying_asset.value.toFixed(2),
                        showarrow: false,
                        bgcolor: "white",
                        xshift: 0,
                        font: {
                            color: "black",
                        },
                    }
                ],
                shapes: [
                    {
                        //spot price line
                        type: 'line',
                        x0: 0,
                        x1: 1,
                        xref: 'paper',

                        y0: formattedData[0]?.content.underlying_asset.value,
                        y1: formattedData[0]?.content.underlying_asset.value,

                        line: {
                            color: 'white',
                            width: 1
                        }
                    }
                ]
            }}
        />
        <Plot
            data={[
                {
                    type: 'bar',
                    x: deltas2,
                    y: [... new Set(strikes)].sort((a, b) => {
                        return b - a
                    }),
                    orientation: 'h',
                    marker: {
                        color: [... new Set(strikes)].sort((a, b) => {
                            return b - a
                        }
                        ).map((strike) => {
                            const item = data[Number(strike)]
                            const delta = (item.up - item.down)
                            return delta > 0 ? "green" : delta < 0 ? "red" : "transparent"
                        })
                    }

                }
            ]}
            layout={{
                width: 800,
                height: 800,
                template: PlotlyTemplate,
                xaxis: {
                    range: [-range2, range2]


                },
                annotations: [
                    {
                        xref: "paper",
                        x: 0,
                        y: formattedData[0]?.content.underlying_asset.value,
                        xanchor: "left",
                        yanchor: "middle",
                        text: formattedData[0]?.content.underlying_asset.value.toFixed(2),
                        showarrow: false,
                        bgcolor: "white",
                        xshift: 0,
                        font: {
                            color: "black",
                        },
                    }
                ],
                shapes: [
                    {
                        //spot price line
                        type: 'line',
                        x0: 0,
                        x1: 1,
                        xref: 'paper',

                        y0: formattedData[0]?.content.underlying_asset.value,
                        y1: formattedData[0]?.content.underlying_asset.value,

                        line: {
                            color: 'white',
                            width: 1
                        }
                    }
                ]
            }}
        />
    </div>

}