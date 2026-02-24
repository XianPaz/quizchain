import { useState } from "react";
import { CONTRACTS } from "../config";

export function useWallet() {
  const [wallet, setWallet] = useState(null);

  const connect = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const chainId  = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== CONTRACTS.CHAIN_HEX) {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CONTRACTS.CHAIN_HEX }],
          });
        }

        setWallet({ address: accounts[0], balance: 0 });
      } catch (e) {
        alert("MetaMask error: " + e.message);
      }
    } else {
      // Demo fallback (no MetaMask installed)
      setWallet({
        address: "0x" + Math.random().toString(16).slice(2, 42),
        balance: Math.floor(Math.random() * 200),
      });
    }
  };

  const disconnect = () => setWallet(null);

  return { wallet, connect, disconnect };
}