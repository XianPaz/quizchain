import { useState, useEffect } from "react";
import { CONTRACTS } from "../config";

export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Silently restore wallet on page load if MetaMask is already authorized
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" })
      .then(accounts => {
        if (accounts.length > 0 && isValidAddress(accounts[0])) {
          setWallet({ address: accounts[0], balance: 0 });
        }
      })
      .catch(() => {});
  }, []);

  // Listen for account changes in MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // User disconnected wallet in MetaMask
        setWallet(null);
        setError("Wallet disconnected. Please reconnect.");
      } else {
        const address = accounts[0];
        if (!isValidAddress(address)) {
          setWallet(null);
          setError("Invalid wallet address detected.");
          return;
        }
        setWallet(prev => prev ? { ...prev, address } : null);
      }
    };

    const handleChainChanged = () => {
      // Reload on network change to avoid stale state
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = async () => {
    setError("");
    setConnecting(true);

    try {
      // Check MetaMask is installed
      if (!window.ethereum) {
        setError("MetaMask is not installed. Please install it from metamask.io");
        setConnecting(false);
        return;
      }

      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setError("No accounts found. Please unlock MetaMask.");
        setConnecting(false);
        return;
      }

      const address = accounts[0];

      // Validate address format
      if (!isValidAddress(address)) {
        setError("Invalid wallet address returned by MetaMask.");
        setConnecting(false);
        return;
      }

      // Check network
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== CONTRACTS.CHAIN_HEX) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CONTRACTS.CHAIN_HEX }],
          });
        } catch (switchError) {
          setError("Please switch to Sepolia Testnet in MetaMask and try again.");
          setConnecting(false);
          return;
        }
      }

      // Re-fetch accounts after chain switch (chain switch can change account)
      const finalAccounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      const finalAddress = finalAccounts[0];
      if (!isValidAddress(finalAddress)) {
        setError("Could not confirm wallet address. Please try again.");
        setConnecting(false);
        return;
      }

      setWallet({ address: finalAddress, balance: 0 });
      setError("");

    } catch (e) {
      if (e.code === 4001) {
        setError("Connection rejected. Please approve the MetaMask request.");
      } else {
        setError("Could not connect wallet: " + e.message);
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setError("");
  };

  return { wallet, connect, disconnect, error, connecting };
}

// Validate Ethereum address format
function isValidAddress(address) {
  return (
    typeof address === "string" &&
    address.startsWith("0x") &&
    address.length === 42 &&
    address !== "0x0000000000000000000000000000000000000000" &&
    /^0x[0-9a-fA-F]{40}$/.test(address)
  );
}