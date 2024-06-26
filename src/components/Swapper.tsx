"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "./ui/input";
import { Address, toTokens, toUnits, toWei } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import approve from "@/transactions/approve";
import swap from "@/transactions/swap";
import { ROUTER, tokens } from "@/constants";
import TransactionButton from "./TransactionButton";
import TokenSelect from "./TokenSelect";
import Token from "@/types/token";
import useQuote from "@/hooks/useQuote";
import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";
import { allowance as thirdwebAllowance, balanceOf } from "thirdweb/extensions/erc20";
import getContract from "@/lib/get-contract";
import JSConfetti from 'js-confetti'

const fetchAllowance = async (tokenIn: Token, recipient: Address) => {
    return thirdwebAllowance({ contract: getContract({ address: tokenIn.address }), owner: recipient, spender: ROUTER });
}

const fetchBalance = async (tokenIn: Token, recipient: Address) => {
    return balanceOf({ contract: getContract({ address: tokenIn.address }), address: recipient });
}


function SwapButton({ tokenIn, tokenOut, amount, fee, recipient, onSuccess }: { tokenIn: Token, tokenOut: Token, amount: bigint, fee: number, recipient: Address, onSuccess: any }) {
    const [allowance, setAllowance] = useState(BigInt(0));
    const [balance, setBalance] = useState(BigInt(0));

    const refetchAllowance = useCallback(() => fetchAllowance(tokenIn, recipient).then(setAllowance), [tokenIn, recipient]);
    const refetchBalance = useCallback(() => fetchBalance(tokenIn, recipient).then(setBalance), [tokenIn, recipient]);
    useEffect(() => {
        refetchAllowance();
        refetchBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenIn, recipient]);

    if (balance < amount) {
        return <div className="flex flex-col text-center">
            <div className="font-semibold text-red-500">No hay suficientes {tokenIn.symbol}!</div>
            <div className="text-sm text-gray-400">Saldo: {toTokens(balance, tokenIn.decimals)}</div>
        </div>
    }

    if (allowance < amount) {
        return (
            <TransactionButton
                transaction={() => {
                    return approve({
                        token: tokenIn,
                        amount: amount,
                        spender: ROUTER
                    })
                }}
                onSent="Enviando la aprobacion de sus tokens ..."
                onConfirmed="Tokens aprobados exitosamente para su uso."
                onError="No se pudieron aprobar los tokens!"
                successCallback={refetchAllowance}
            >
                Aprobar
            </TransactionButton>
        )
    }

    const handleSuccesfulSwap = () => {
      refetchBalance()      
      onSuccess()
    }

    return (
        <TransactionButton
            transaction={async () => {
                return swap({
                    inputToken: tokenIn,
                    inputAmount: amount,
                    outputToken: tokenOut,
                    recipient: recipient,
                    fee
                });
            }}
            onSent="Swap enviado..."
            onConfirmed="El Swap fue exitoso!."
            onError="Error al completar el Swap."
            successCallback={handleSuccesfulSwap}
        >
            Ejecutar Swap
        </TransactionButton>
    )
}

export default function Swapper() {
    const account = useActiveAccount();
    const [amount, setAmount] = useState<number>(0);
    const [inputTokenKey, setInputTokenKey] = useState<string | undefined>();
    const [outputTokenKey, setOutputTokenKey] = useState<string | undefined>();

    const inputToken = useMemo(() => inputTokenKey ? tokens[inputTokenKey] : undefined, [inputTokenKey]);
    const outputToken = useMemo(() => outputTokenKey ? tokens[outputTokenKey] : undefined, [outputTokenKey]);
    const { loading: quoteLoading, fee, outputAmount } = useQuote({ tokenIn: inputToken, tokenOut: outputToken, amount: toUnits(amount.toString(), inputToken?.decimals ?? 18) });

    const canSwap = !quoteLoading && account && inputToken && outputToken && amount && fee;

    const jsConfetti = new JSConfetti()

    const handleSuccessSwapLocal = () => {
      setAmount(0)      
      jsConfetti.addConfetti()      
    }

    return <Card className="">
        <CardHeader>
            <CardTitle style={{color:"#0A0FA7"}}>Swap</CardTitle>
        </CardHeader>
        <CardContent className="">
            <div className="flex w-[400px] flex-col items-center gap-4">
                <div className="flex w-full items-center gap-2">
                  <TokenSelect selectedKey={inputTokenKey} onSelect={setInputTokenKey} />
                  <Input value={amount} placeholder="0" type="number" onChange={(e) => setAmount(parseFloat(e.target.value || "0"))} className="w-full" />                    
                </div>
                <div className={cn("flex items-center w-full gap-2", quoteLoading && "animate-pulse")}>
                  <TokenSelect selectedKey={outputTokenKey} onSelect={setOutputTokenKey} />
                  <div className="w-full text-slate-600 mx-3 relative h-8">
                      {quoteLoading ? <div className="flex h-full items-center absolute left-0"><Loader2Icon className="animate-spin w-4 h-4" /></div> :
                          <div>{outputAmount && outputToken ? toTokens(outputAmount, outputToken.decimals) : 0}</div>
                      }
                  </div>                    
                </div>
            </div>
            <div className="mt-4 w-full">
                {canSwap ? 
                  <SwapButton 
                    fee={fee}
                    recipient={account.address as Address}
                    tokenIn={inputToken}
                    tokenOut={outputToken}
                    amount={toUnits(amount.toString(), inputToken?.decimals ?? 18)}
                    onSuccess={handleSuccessSwapLocal}
                  />
                : <></>}
            </div>
        </CardContent>
    </Card>
}
